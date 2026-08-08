"""Project endpoints.

A user sees only the projects they hold a `projects` view permission on —
organization-wide, or through a role granted on that specific project.
"""

import re
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import (
    CurrentUser,
    DbSession,
    require_permission,
    require_project_permission,
)
from app.models.project import Project, ProjectStatus
from app.models.role import Feature, Role, RoleScope
from app.models.user import User
from app.services.rbac import accessible_project_ids, assign_role, effective_permissions

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    key: str
    description: str | None
    status: ProjectStatus
    start_date: date | None
    end_date: date | None
    owner_id: int | None


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    key: str = Field(min_length=1, max_length=16)
    description: str | None = None
    status: ProjectStatus = ProjectStatus.PLANNING
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("key")
    @classmethod
    def key_is_a_short_code(cls, value: str) -> str:
        cleaned = value.strip().upper()
        if not re.fullmatch(r"[A-Z0-9]{2,16}", cleaned):
            raise ValueError("must be 2-16 letters or digits, e.g. STO")
        return cleaned

    @model_validator(mode="after")
    def dates_must_run_forwards(self) -> "ProjectCreate":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class FeaturePermission(BaseModel):
    view: bool
    create: bool
    edit: bool
    delete: bool


CanViewProject = Annotated[Project, Depends(require_project_permission(Feature.PROJECTS, "view"))]


@router.get(
    "/{project_id}/permissions",
    response_model=dict[Feature, FeaturePermission],
    summary="What you may do in this project",
)
async def read_project_permissions(
    project: CanViewProject, current_user: CurrentUser, db: DbSession
) -> dict[Feature, FeaturePermission]:
    """Resolve the caller's own permissions inside one project.

    Lets the interface hide actions that would only fail, rather than offering
    a button that returns 403. It reports nothing about anyone else.
    """
    granted = await effective_permissions(db, user_id=current_user.id, project_id=project.id)
    return {
        feature: FeaturePermission(
            view=permission.view,
            create=permission.create,
            edit=permission.edit,
            delete=permission.delete,
        )
        for feature, permission in granted.items()
    }


@router.post(
    "",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project",
)
async def create_project(
    payload: ProjectCreate,
    current_user: Annotated[User, Depends(require_permission(Feature.PROJECTS, "create"))],
    db: DbSession,
) -> Project:
    """Create a project and put the creator on it.

    The role grant is not optional politeness: access is project-scoped, so a
    project nobody holds a role on is invisible the moment it is created — the
    author would lose sight of their own work.
    """
    project = Project(
        organization_id=current_user.organization_id,
        name=payload.name.strip(),
        key=payload.key,
        description=(payload.description or "").strip() or None,
        status=payload.status,
        start_date=payload.start_date,
        end_date=payload.end_date,
        owner_id=current_user.id,
        created_by=current_user.id,
    )
    db.add(project)

    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"A project with key {payload.key!r} already exists"
        ) from exc

    await _grant_creator_access(db, project, current_user)
    await db.commit()
    await db.refresh(project)
    return project


async def _grant_creator_access(db: DbSession, project: Project, creator: User) -> None:
    """Give the creator a project-scoped Project Manager role.

    Skipped when they already have organization-wide project access, since
    another grant would add nothing.
    """
    organization_wide, _ = await accessible_project_ids(
        db, user_id=creator.id, feature=Feature.PROJECTS
    )
    if organization_wide:
        return

    result = await db.execute(
        select(Role).where(
            Role.organization_id == creator.organization_id,
            Role.slug == "project-manager",
            Role.scope == RoleScope.PROJECT,
        )
    )
    manager = result.scalar_one_or_none()
    if manager is not None:
        await assign_role(db, user_id=creator.id, role=manager, project_id=project.id)


@router.get("", response_model=list[ProjectRead], summary="List the projects you can see")
async def read_projects(current_user: CurrentUser, db: DbSession) -> list[Project]:
    organization_wide, project_ids = await accessible_project_ids(
        db, user_id=current_user.id, feature=Feature.PROJECTS
    )
    if not organization_wide and not project_ids:
        return []

    query = select(Project).where(Project.organization_id == current_user.organization_id)
    if not organization_wide:
        query = query.where(Project.id.in_(project_ids))

    result = await db.execute(query.order_by(Project.name))
    return list(result.scalars().all())

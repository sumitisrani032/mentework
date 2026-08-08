"""Project endpoints.

A user sees only the projects they hold a `projects` view permission on —
organization-wide, or through a role granted on that specific project.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_project_permission
from app.models.project import Project, ProjectStatus
from app.models.role import Feature
from app.services.rbac import accessible_project_ids, effective_permissions

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    key: str
    description: str | None
    status: ProjectStatus


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

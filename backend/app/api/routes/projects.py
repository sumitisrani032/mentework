"""Project endpoints.

A user sees only the projects they hold a `projects` view permission on —
organization-wide, or through a role granted on that specific project.
"""


from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.project import Project, ProjectStatus
from app.models.role import Feature
from app.services.rbac import accessible_project_ids

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    key: str
    description: str | None
    status: ProjectStatus


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

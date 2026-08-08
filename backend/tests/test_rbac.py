import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.project import Project
from app.models.role import Feature, Role, RolePermission, RoleScope
from app.models.user import User
from app.services.rbac import (
    DEFAULT_ROLES,
    RbacError,
    assign_role,
    effective_permissions,
    list_roles,
    seed_default_roles,
)


async def make_user(session: AsyncSession, org: Organization, email: str) -> User:
    user = User(organization_id=org.id, email=email, full_name="Test Person")
    session.add(user)
    await session.flush()
    return user


async def make_project(session: AsyncSession, org: Organization, key: str) -> Project:
    project = Project(organization_id=org.id, name=f"Project {key}", key=key)
    session.add(project)
    await session.flush()
    return project


async def test_seeding_creates_every_default_role(
    db_session: AsyncSession, organization: Organization
) -> None:
    await seed_default_roles(db_session, organization)

    roles = await list_roles(db_session, organization.id)
    assert {role.slug for role in roles} == {d.slug for d in DEFAULT_ROLES}
    assert all(role.is_system for role in roles)


async def test_every_role_gets_a_complete_matrix(
    db_session: AsyncSession, organization: Organization
) -> None:
    await seed_default_roles(db_session, organization)

    # The settings grid renders a checkbox per feature, so a row must exist for
    # every feature even when nothing is granted.
    for role in await list_roles(db_session, organization.id):
        assert {permission.feature for permission in role.permissions} == set(Feature)


async def test_organization_admin_can_do_everything(
    db_session: AsyncSession, organization: Organization
) -> None:
    await seed_default_roles(db_session, organization)
    roles = {role.slug: role for role in await list_roles(db_session, organization.id)}

    for permission in roles["organization-admin"].permissions:
        assert permission.can_view
        assert permission.can_create
        assert permission.can_edit
        assert permission.can_delete


async def test_viewer_is_read_only(db_session: AsyncSession, organization: Organization) -> None:
    await seed_default_roles(db_session, organization)
    roles = {role.slug: role for role in await list_roles(db_session, organization.id)}

    for permission in roles["viewer"].permissions:
        assert not permission.can_create
        assert not permission.can_edit
        assert not permission.can_delete


async def test_project_role_requires_a_project(
    db_session: AsyncSession, organization: Organization
) -> None:
    await seed_default_roles(db_session, organization)
    roles = {role.slug: role for role in await list_roles(db_session, organization.id)}
    user = await make_user(db_session, organization, "lead@acme.test")

    with pytest.raises(RbacError, match="project-scoped"):
        await assign_role(db_session, user_id=user.id, role=roles["team-lead"])


async def test_organization_role_rejects_a_project(
    db_session: AsyncSession, organization: Organization
) -> None:
    await seed_default_roles(db_session, organization)
    roles = {role.slug: role for role in await list_roles(db_session, organization.id)}
    user = await make_user(db_session, organization, "admin@acme.test")
    project = await make_project(db_session, organization, "WEB")

    with pytest.raises(RbacError, match="organization-wide"):
        await assign_role(
            db_session,
            user_id=user.id,
            role=roles["organization-admin"],
            project_id=project.id,
        )


async def test_the_same_grant_cannot_be_made_twice(
    db_session: AsyncSession, organization: Organization
) -> None:
    await seed_default_roles(db_session, organization)
    roles = {role.slug: role for role in await list_roles(db_session, organization.id)}
    user = await make_user(db_session, organization, "admin@acme.test")

    await assign_role(db_session, user_id=user.id, role=roles["organization-admin"])

    # project_id is NULL for both rows, so this only fails because the unique
    # constraint uses NULLS NOT DISTINCT.
    with pytest.raises(IntegrityError):
        await assign_role(db_session, user_id=user.id, role=roles["organization-admin"])


async def test_permissions_are_the_union_of_every_applicable_role(
    db_session: AsyncSession, organization: Organization
) -> None:
    await seed_default_roles(db_session, organization)
    roles = {role.slug: role for role in await list_roles(db_session, organization.id)}
    user = await make_user(db_session, organization, "person@acme.test")
    website = await make_project(db_session, organization, "WEB")
    mobile = await make_project(db_session, organization, "MOB")

    await assign_role(db_session, user_id=user.id, role=roles["member"], project_id=website.id)
    await assign_role(db_session, user_id=user.id, role=roles["viewer"], project_id=mobile.id)

    on_website = await effective_permissions(db_session, user_id=user.id, project_id=website.id)
    on_mobile = await effective_permissions(db_session, user_id=user.id, project_id=mobile.id)

    # Member may log time on the website project; Viewer may not on mobile.
    assert on_website[Feature.TIMESHEET].create
    assert not on_mobile[Feature.TIMESHEET].create
    assert on_mobile[Feature.TASKS].view


async def test_organization_grants_apply_inside_every_project(
    db_session: AsyncSession, organization: Organization
) -> None:
    await seed_default_roles(db_session, organization)
    roles = {role.slug: role for role in await list_roles(db_session, organization.id)}
    user = await make_user(db_session, organization, "boss@acme.test")
    project = await make_project(db_session, organization, "WEB")

    await assign_role(db_session, user_id=user.id, role=roles["organization-admin"])

    within_project = await effective_permissions(db_session, user_id=user.id, project_id=project.id)
    assert within_project[Feature.BILLING].delete


async def test_a_user_with_no_roles_can_do_nothing(
    db_session: AsyncSession, organization: Organization
) -> None:
    user = await make_user(db_session, organization, "newcomer@acme.test")

    granted = await effective_permissions(db_session, user_id=user.id)

    assert set(granted) == set(Feature)
    assert not any(permission.view for permission in granted.values())


async def test_a_permission_cannot_grant_editing_without_viewing(
    db_session: AsyncSession, organization: Organization
) -> None:
    role = Role(
        organization_id=organization.id,
        slug="broken",
        name="Broken",
        scope=RoleScope.PROJECT,
        permissions=[RolePermission(feature=Feature.TASKS, can_view=False, can_edit=True)],
    )
    db_session.add(role)

    with pytest.raises(IntegrityError):
        await db_session.flush()

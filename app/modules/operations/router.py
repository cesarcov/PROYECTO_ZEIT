from fastapi import APIRouter, Depends
from app.core.security.dependencies import get_current_user
from app.modules.operations.schemas import (
    ProjectPlanCreate,
    ProjectPlanUpdate,
    ProjectPlanItemCreate,
    ProjectPlanItemUpdate,
    SubmitPlanPayload,
    MaterialPropose,
    MaterialGroupCreate,
    MaterialGroupUpdate,
    MaterialGroupItemCreate,
)
from app.modules.operations.service import (
    list_my_plans_service,
    create_plan_service,
    get_plan_detail_service,
    add_plan_item_service,
    update_plan_item_service,
    remove_plan_item_service,
    create_submission_service,
    list_plan_submissions_service,
    list_my_all_submissions_service,
    update_plan_service,
    delete_plan_service,
    propose_material_service,
    list_material_groups_service,
    get_material_group_service,
    create_material_group_service,
    update_material_group_service,
    delete_material_group_service,
    add_item_to_group_service,
    remove_item_from_group_service,
    apply_group_to_plan_service,
    clone_plan_service,
)

router = APIRouter(prefix="/operations", tags=["Operations"])


# ── PROPONER MATERIAL ─────────────────────────────────────────

@router.post("/materials/propose")
def propose_material(payload: MaterialPropose, current_user=Depends(get_current_user)):
    return propose_material_service(payload, current_user)


# ── CRUD PLAN ─────────────────────────────────────────────────

@router.get("/plans")
def list_my_plans(current_user=Depends(get_current_user)):
    return list_my_plans_service(current_user)


@router.post("/plans")
def create_plan(payload: ProjectPlanCreate, current_user=Depends(get_current_user)):
    return create_plan_service(payload, current_user)


@router.get("/plans/{plan_id}")
def get_plan(plan_id: str, current_user=Depends(get_current_user)):
    return get_plan_detail_service(plan_id, current_user)


@router.patch("/plans/{plan_id}")
def update_plan(plan_id: str, payload: ProjectPlanUpdate, current_user=Depends(get_current_user)):
    return update_plan_service(plan_id, payload, current_user)


@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: str, current_user=Depends(get_current_user)):
    return delete_plan_service(plan_id, current_user)


@router.post("/plans/{plan_id}/clone")
def clone_plan(plan_id: str, current_user=Depends(get_current_user)):
    return clone_plan_service(plan_id, current_user)


# ── CRUD ÍTEMS ────────────────────────────────────────────────

@router.post("/plans/{plan_id}/items")
def add_item(plan_id: str, payload: ProjectPlanItemCreate, current_user=Depends(get_current_user)):
    return add_plan_item_service(plan_id, payload, current_user)


@router.patch("/plans/{plan_id}/items/{item_id}")
def update_item(plan_id: str, item_id: str, payload: ProjectPlanItemUpdate, current_user=Depends(get_current_user)):
    return update_plan_item_service(plan_id, item_id, payload, current_user)


@router.delete("/plans/{plan_id}/items/{item_id}")
def remove_item(plan_id: str, item_id: str, current_user=Depends(get_current_user)):
    return remove_plan_item_service(plan_id, item_id, current_user)


# ── SUBMISSIONS (lotes de requerimientos numerados) ───────────

@router.post("/plans/{plan_id}/submit")
def submit_plan(
    plan_id: str,
    payload: SubmitPlanPayload,
    current_user=Depends(get_current_user)
):
    return create_submission_service(plan_id, current_user, payload.reason)


@router.get("/plans/{plan_id}/submissions")
def list_submissions(plan_id: str, current_user=Depends(get_current_user)):
    return list_plan_submissions_service(plan_id, current_user)


@router.get("/submissions")
def list_my_all_submissions(current_user=Depends(get_current_user)):
    return list_my_all_submissions_service(current_user)


# ── BÓVEDAS / GRUPOS DE MATERIALES ───────────────────────────

@router.get("/material-groups")
def list_material_groups(current_user=Depends(get_current_user)):
    return list_material_groups_service()


@router.post("/material-groups")
def create_material_group(payload: MaterialGroupCreate, current_user=Depends(get_current_user)):
    return create_material_group_service(payload, current_user)


@router.get("/material-groups/{group_id}")
def get_material_group(group_id: str, current_user=Depends(get_current_user)):
    return get_material_group_service(group_id)


@router.patch("/material-groups/{group_id}")
def update_material_group(group_id: str, payload: MaterialGroupUpdate, current_user=Depends(get_current_user)):
    return update_material_group_service(group_id, payload)


@router.delete("/material-groups/{group_id}")
def delete_material_group(group_id: str, current_user=Depends(get_current_user)):
    return delete_material_group_service(group_id)


@router.post("/material-groups/{group_id}/items")
def add_group_item(group_id: str, payload: MaterialGroupItemCreate, current_user=Depends(get_current_user)):
    return add_item_to_group_service(group_id, payload)


@router.delete("/material-groups/{group_id}/items/{item_id}")
def remove_group_item(group_id: str, item_id: str, current_user=Depends(get_current_user)):
    return remove_item_from_group_service(group_id, item_id)


@router.post("/plans/{plan_id}/apply-group/{group_id}")
def apply_group_to_plan(plan_id: str, group_id: str, current_user=Depends(get_current_user)):
    return apply_group_to_plan_service(plan_id, group_id, current_user)

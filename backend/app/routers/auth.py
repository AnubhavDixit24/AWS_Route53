from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session as DBSession
import os
from ..database import get_db
from ..auth import (
    authenticate_user,
    create_session,
    destroy_session,
    get_current_user,
    COOKIE_NAME,
)
from ..models import User
from ..schemas import LoginRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, response: Response, db: DBSession = Depends(get_db)):
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    session = create_session(db, user)

    IS_PROD = os.environ.get("RENDER") is not None

    response.set_cookie(
        key=COOKIE_NAME,
        value=session.token,
        httponly=True,
        samesite="none" if IS_PROD else "lax",
        secure=IS_PROD,
        max_age=60 * 60 * 24 * 7,
    )


    return user


@router.post("/logout")
def logout(response: Response, request: Request, db: DBSession = Depends(get_db)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        destroy_session(db, token)
    response.delete_cookie(COOKIE_NAME)
    return {"message": "logged out"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
"""
Integración con Microsoft SharePoint Online mediante Microsoft Graph API.
Permite autenticar de forma no interactiva (Client Credentials Flow)
y subir archivos binarios (reportes) a una biblioteca de documentos de SharePoint.
"""
import os
import logging
import requests
from dotenv import load_dotenv

# Cargar variables de entorno locales
load_dotenv()

logger = logging.getLogger(__name__)

TENANT_ID = os.getenv("SHAREPOINT_TENANT_ID")
CLIENT_ID = os.getenv("SHAREPOINT_CLIENT_ID")
CLIENT_SECRET = os.getenv("SHAREPOINT_CLIENT_SECRET")
SITE_NAME = os.getenv("SHAREPOINT_SITE_NAME")
FOLDER_PATH = os.getenv("SHAREPOINT_FOLDER_PATH", "Documentos compartidos/ERP_Reportes")


def get_access_token() -> str:
    """
    Obtiene el token de acceso OAuth2 temporal desde Microsoft Identity.
    """
    if not all([TENANT_ID, CLIENT_ID, CLIENT_SECRET]):
        raise ValueError(
            "Faltan las credenciales de SharePoint en el archivo .env. "
            "Asegúrate de configurar SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID y SHAREPOINT_CLIENT_SECRET."
        )

    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "client_id": CLIENT_ID,
        "scope": "https://graph.microsoft.com/.default",
        "client_secret": CLIENT_SECRET,
        "grant_type": "client_credentials",
    }
    
    try:
        r = requests.post(url, headers=headers, data=data, timeout=10)
        r.raise_for_status()
        return r.json()["access_token"]
    except Exception as e:
        logger.exception("Error al autenticar con Microsoft Graph API")
        raise RuntimeError(f"Fallo en la autenticación de SharePoint: {e}") from e


def upload_file_to_sharepoint(file_content: bytes, filename: str) -> str:
    """
    Sube un archivo de bytes a SharePoint Online y devuelve la URL pública/web de visualización.
    """
    if not SITE_NAME:
        raise ValueError("SHAREPOINT_SITE_NAME no está configurada en el archivo .env.")

    token = get_access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/octet-stream"
    }

    try:
        # 1. Obtener el ID único del sitio de SharePoint a partir de su nombre descriptivo
        site_url = f"https://graph.microsoft.com/v1.0/sites/root:/sites/{SITE_NAME}"
        r_site = requests.get(site_url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
        r_site.raise_for_status()
        site_id = r_site.json()["id"]

        # 2. Subir el archivo binario a la carpeta configurada en SharePoint
        # Se normaliza la ruta quitando barras duplicadas o espacios iniciales/finales
        normalized_folder = FOLDER_PATH.strip("/").strip()
        upload_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drive/root:/{normalized_folder}/{filename}:/content"
        
        logger.info(f"Subiendo archivo '{filename}' a SharePoint en: {normalized_folder} ...")
        r_upload = requests.put(upload_url, headers=headers, data=file_content, timeout=30)
        r_upload.raise_for_status()
        
        # 3. Retornar el enlace directo a la visualización web (Excel Online / PDF Viewer)
        web_url = r_upload.json().get("webUrl")
        logger.info(f"Archivo subido exitosamente. URL: {web_url}")
        return web_url

    except Exception as e:
        logger.exception(f"Error al subir el archivo '{filename}' a SharePoint")
        raise RuntimeError(f"Fallo en la subida a SharePoint: {e}") from e

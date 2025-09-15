# db/ingest.py
import io
from fastapi import UploadFile
from langchain.text_splitter import RecursiveCharacterTextSplitter
from PyPDF2 import PdfReader
from db.base import VectorDB

async def read_file_content(file: UploadFile) -> str:
    """
    Reads the contents of an uploaded file (txt, md, pdf).
    Returns extracted plain text.
    """
    content = await file.read()
    if file.filename.endswith(".txt") or file.filename.endswith(".md"):
        return content.decode("utf-8")
    elif file.filename.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content))
        text = "\n".join([page.extract_text() or "" for page in reader.pages])
        return text
    else:
        raise ValueError("Unsupported file type. Please upload .txt, .md, or .pdf")

async def ingest_file(file: UploadFile, db: VectorDB, chunk_size: int = 500, chunk_overlap: int = 50) -> int:
    """
    Parse file, chunk text, and ingest each chunk into the DB.
    Returns number of chunks ingested.
    """
    text = await read_file_content(file)
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )
    chunks = splitter.split_text(text)

    for chunk in chunks:
        db.ingest_text(chunk)

    return len(chunks)

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  deletePlaceDocumentAction,
  getPlaceDocumentSignedUrlAction,
  listPlaceDocumentsAction,
  uploadPlaceDocumentAction,
} from "@/app/planificar/place-document-actions";
import {
  ALLOWED_PLACE_DOCUMENT_EXTENSIONS,
  formatDocumentCreatedAt,
  MAX_PLACE_DOCUMENT_SIZE_BYTES,
  validatePlaceDocumentFile,
  type PlaceDocumentListItem,
} from "@/lib/places/place-documents";

type PlaceDocumentsSectionProps = {
  placeId: string;
};

const ACCEPT_ATTRIBUTE = ALLOWED_PLACE_DOCUMENT_EXTENSIONS.join(",");

export function PlaceDocumentsSection({ placeId }: PlaceDocumentsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<PlaceDocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isUploading, startUpload] = useTransition();
  const [isOpeningId, setIsOpeningId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLocalError(null);

    listPlaceDocumentsAction(placeId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setDocuments([]);
        setLocalError(result.error);
        setLoading(false);
        return;
      }

      setDocuments(result.data ?? []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [placeId]);

  function handleChooseFile() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const validation = validatePlaceDocumentFile(file);
    if (!validation.ok) {
      setLocalError(validation.error);
      return;
    }

    setLocalError(null);

    const formData = new FormData();
    formData.set("placeId", placeId);
    formData.set("file", file);

    startUpload(async () => {
      const result = await uploadPlaceDocumentAction(formData);
      if (!result.ok) {
        setLocalError(result.error);
        return;
      }

      if (result.data) {
        setDocuments((current) => [result.data!, ...current]);
      } else {
        const refreshed = await listPlaceDocumentsAction(placeId);
        if (refreshed.ok) {
          setDocuments(refreshed.data ?? []);
        }
      }
    });
  }

  async function handleOpen(documentId: string) {
    setLocalError(null);
    setIsOpeningId(documentId);

    const result = await getPlaceDocumentSignedUrlAction(documentId);
    setIsOpeningId(null);

    if (!result.ok || !result.data?.url) {
      setLocalError(result.ok ? "No se pudo abrir el documento." : result.error);
      return;
    }

    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(documentId: string) {
    setLocalError(null);
    setIsDeletingId(documentId);

    const result = await deletePlaceDocumentAction(documentId);
    setIsDeletingId(null);
    setPendingDeleteId(null);

    if (!result.ok) {
      setLocalError(result.error);
      return;
    }

    setDocuments((current) => current.filter((document) => document.id !== documentId));
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-200">Documentos</h3>
          <p className="mt-1 text-xs text-slate-500">
            PDF, PNG, JPG o .pkpass · máximo 10 MB
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="hidden"
            onChange={handleFileSelected}
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={handleChooseFile}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 disabled:opacity-60"
          >
            {isUploading ? "Subiendo..." : "Subir archivo"}
          </button>
        </div>
      </div>

      {localError ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {localError}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-slate-400">Cargando documentos...</p>
      ) : documents.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Aún no hay tickets ni documentos adjuntos a este lugar.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {documents.map((document) => {
            const isOpening = isOpeningId === document.id;
            const isDeleting = isDeletingId === document.id;
            const confirmDelete = pendingDeleteId === document.id;

            return (
              <li
                key={document.id}
                className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {document.file_name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDocumentCreatedAt(document.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isOpening || isDeleting}
                      onClick={() => handleOpen(document.id)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                    >
                      {isOpening ? "Abriendo..." : "Abrir"}
                    </button>

                    {confirmDelete ? (
                      <>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDelete(document.id)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
                        >
                          {isDeleting ? "Eliminando..." : "Confirmar"}
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => setPendingDeleteId(null)}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={isOpening || isDeleting}
                        onClick={() => setPendingDeleteId(document.id)}
                        className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-200 hover:bg-red-950/40 disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-xs text-slate-600">
        Límite de subida: {Math.round(MAX_PLACE_DOCUMENT_SIZE_BYTES / (1024 * 1024))} MB por archivo.
      </p>
    </section>
  );
}

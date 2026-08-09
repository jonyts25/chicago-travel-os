"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  deletePlaceDocumentAction,
  getPlaceDocumentSignedUrlAction,
  listPlaceDocumentsAction,
  uploadPlaceDocumentAction,
} from "@/app/planificar/place-document-actions";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast-provider";
import {
  ALLOWED_PLACE_DOCUMENT_EXTENSIONS,
  formatDocumentCreatedAt,
  MAX_PLACE_DOCUMENT_SIZE_BYTES,
  validatePlaceDocumentFile,
  type PlaceDocumentListItem,
} from "@/lib/places/place-documents";
import { cn, surfaces, typography } from "@/lib/ui/styles";

type PlaceDocumentsSectionProps = {
  placeId: string;
};

const ACCEPT_ATTRIBUTE = ALLOWED_PLACE_DOCUMENT_EXTENSIONS.join(",");

export function PlaceDocumentsSection({ placeId }: PlaceDocumentsSectionProps) {
  const { showToast } = useToast();
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

      showToast("Documento subido.");
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
    showToast("Documento eliminado.");
  }

  return (
    <section className={cn(surfaces.inset, "p-4")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className={typography.body}>Documentos</h3>
          <p className={cn(typography.muted, "mt-1")}>
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
          <Button
            type="button"
            variant="secondary"
            disabled={isUploading}
            loading={isUploading}
            onClick={handleChooseFile}
          >
            Subir archivo
          </Button>
        </div>
      </div>

      {localError ? (
        <ErrorMessage
          className="mt-3"
          message="No se pudo completar la operación con documentos."
          technicalDetails={localError}
        />
      ) : null}

      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : documents.length === 0 ? (
        <p className={cn(typography.secondary, "mt-4")}>
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
                className={cn(surfaces.inset, "bg-slate-950/70 px-3 py-3")}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className={cn(typography.body, "truncate font-medium")}>
                      {document.file_name}
                    </p>
                    <p className={cn(typography.muted, "mt-1")}>
                      {formatDocumentCreatedAt(document.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      disabled={isOpening || isDeleting}
                      loading={isOpening}
                      onClick={() => handleOpen(document.id)}
                    >
                      Abrir
                    </Button>

                    {confirmDelete ? (
                      <>
                        <Button
                          type="button"
                          variant="danger"
                          disabled={isDeleting}
                          loading={isDeleting}
                          onClick={() => handleDelete(document.id)}
                        >
                          Confirmar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={isDeleting}
                          onClick={() => setPendingDeleteId(null)}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="danger"
                        disabled={isOpening || isDeleting}
                        onClick={() => setPendingDeleteId(document.id)}
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className={cn(typography.muted, "mt-3 text-slate-600")}>
        Límite de subida: {Math.round(MAX_PLACE_DOCUMENT_SIZE_BYTES / (1024 * 1024))} MB por archivo.
      </p>
    </section>
  );
}

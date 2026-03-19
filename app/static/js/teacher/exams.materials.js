// app/static/js/teacher/exams.materials.js
(() => {
  window.TEACHER = window.TEACHER || {};
  const NS = window.TEACHER;

  const materials = (NS.examsMaterials = NS.examsMaterials || {});

  async function listMaterials(examId) {
    if (!examId) return [];
    const res = await window.DASH.api(`/exams/${examId}/materials`, { method: "GET" });
    return res?.items || [];
  }

  async function deleteMaterial(examId, materialId) {
    if (!examId) throw new Error("Missing exam ID.");
    await window.DASH.api(`/exams/${examId}/materials/${materialId}`, {
      method: "DELETE",
    });
  }

async function openMaterial(examId, materialId) {
  if (!examId) return;

  const token = localStorage.getItem("access_token"); // o dove lo salvi

  const res = await fetch(`/exams/${examId}/materials/${materialId}/download`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Download failed");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  window.open(url, "_blank");
}

  async function uploadMaterialPdfToExam(examId, file) {
    if (!examId) throw new Error("Missing exam ID.");
    if (!file) throw new Error("Select a PDF file.");

    const isPdf =
      file.type === "application/pdf" || String(file.name || "").toLowerCase().endsWith(".pdf");
    if (!isPdf) throw new Error("Invalid format: please upload a PDF.");

    const form = new FormData();
    form.append("file", file);

    return await window.DASH.api(`/exams/${examId}/materials/pdf`, {
      method: "POST",
      body: form,
    });
  }

  materials.listMaterials = listMaterials;
  materials.deleteMaterial = deleteMaterial;
  materials.openMaterial = openMaterial;
  materials.uploadMaterialPdfToExam = uploadMaterialPdfToExam;
})();
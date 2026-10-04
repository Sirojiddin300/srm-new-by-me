import JSZip from "jszip";

export async function downloadSourceZip(filename = "source-code.zip") {
  const zip = new JSZip();
  zip.file("README.md", "# 21ASR CRM\nWhatsApp CRM powered by Green API");
  
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

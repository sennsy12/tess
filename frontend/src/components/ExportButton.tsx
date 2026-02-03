import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ExportButtonProps {
  targetRef: React.RefObject<HTMLElement>;
  filename: string;
}

export function ExportButton({ targetRef, filename }: ExportButtonProps) {
  const exportToPDF = async () => {
    if (!targetRef.current) return;

    const canvas = await html2canvas(targetRef.current, {
      backgroundColor: '#0f172a',
      scale: 2,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`${filename}.pdf`);
  };

  const exportToImage = async () => {
    if (!targetRef.current) return;

    const canvas = await html2canvas(targetRef.current, {
      backgroundColor: '#0f172a',
      scale: 2,
    });

    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={exportToPDF} className="btn-secondary text-xs sm:text-sm flex-1 min-w-0 truncate">
        <span className="sm:hidden">📄 PDF</span>
        <span className="hidden sm:inline">📄 Eksporter PDF</span>
      </button>
      <button onClick={exportToImage} className="btn-secondary text-xs sm:text-sm flex-1 min-w-0 truncate">
        <span className="sm:hidden">🖼️ Bilde</span>
        <span className="hidden sm:inline">🖼️ Eksporter Bilde</span>
      </button>
    </div>
  );
}

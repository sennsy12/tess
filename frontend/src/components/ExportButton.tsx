import { FileDown, Image } from 'lucide-react';

interface ExportButtonProps {
  targetRef: React.RefObject<HTMLElement>;
  filename: string;
}

export function ExportButton({ targetRef, filename }: ExportButtonProps) {
  const exportToPDF = async () => {
    if (!targetRef.current) return;

    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

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

    const { default: html2canvas } = await import('html2canvas');

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
      <button onClick={exportToPDF} className="btn-secondary text-xs sm:text-sm flex items-center gap-1.5">
        <FileDown className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Eksporter PDF</span>
        <span className="sm:hidden">PDF</span>
      </button>
      <button onClick={exportToImage} className="btn-secondary text-xs sm:text-sm flex items-center gap-1.5">
        <Image className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Eksporter Bilde</span>
        <span className="sm:hidden">Bilde</span>
      </button>
    </div>
  );
}

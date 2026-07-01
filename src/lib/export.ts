import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface ExportOptions {
  filename?: string;
  title?: string;
  stockCode?: string;
  stockName?: string;
}

/**
 * Convert oklch/lab color values in computed styles to rgb.
 * html2canvas does not support modern CSS color functions.
 */
function convertModernColorsToRgb(element: HTMLElement): void {
  const allElements = [element, ...Array.from(element.querySelectorAll('*'))];

  for (const el of allElements) {
    const htmlEl = el as HTMLElement;
    const computed = window.getComputedStyle(htmlEl);

    // Properties that commonly contain colors
    const colorProps = [
      'color', 'background-color', 'border-color', 'border-top-color',
      'border-right-color', 'border-bottom-color', 'border-left-color',
      'outline-color', 'box-shadow', 'text-shadow', 'caret-color',
      'column-rule-color', 'fill', 'stroke',
    ];

    for (const prop of colorProps) {
      const value = computed.getPropertyValue(prop);
      if (value && (value.includes('oklch(') || value.includes('lab(') || value.includes('lch('))) {
        try {
          // Create a temporary element to convert the color
          const temp = document.createElement('div');
          temp.style.color = value;
          document.body.appendChild(temp);
          const rgbValue = window.getComputedStyle(temp).color;
          document.body.removeChild(temp);

          if (rgbValue && rgbValue.startsWith('rgb')) {
            htmlEl.style.setProperty(prop, rgbValue, 'important');
          }
        } catch {
          // If conversion fails, try to set a fallback
          if (prop === 'background-color') {
            htmlEl.style.setProperty(prop, '#111827', 'important');
          } else if (prop === 'color') {
            htmlEl.style.setProperty(prop, '#e5e7eb', 'important');
          } else if (prop.includes('border')) {
            htmlEl.style.setProperty(prop, '#1e293b', 'important');
          }
        }
      }
    }
  }
}

/**
 * Inline all computed styles recursively, converting modern colors to rgb.
 */
function cloneWithInlineStyles(element: HTMLElement): HTMLElement {
  // First convert modern colors on the original element
  convertModernColorsToRgb(element);

  const clone = element.cloneNode(true) as HTMLElement;
  const originalElements = [element, ...Array.from(element.querySelectorAll('*'))];
  const clonedElements = [clone, ...Array.from(clone.querySelectorAll('*'))];

  for (let i = 0; i < originalElements.length; i++) {
    const orig = originalElements[i] as HTMLElement;
    const cloned = clonedElements[i] as HTMLElement;

    const computed = window.getComputedStyle(orig);
    const inline: Record<string, string> = {};

    // Copy all computed styles as inline styles
    for (let j = 0; j < computed.length; j++) {
      const prop = computed[j];
      const value = computed.getPropertyValue(prop);
      if (value) {
        inline[prop] = value;
      }
    }

    // Apply inline styles
    for (const [prop, value] of Object.entries(inline)) {
      // Skip problematic properties for html2canvas
      if (prop === 'animation' || prop === 'transition') continue;
      cloned.style.setProperty(prop, value, 'important');
    }
  }

  return clone;
}

/**
 * Create an off-screen container with the cloned element for capture.
 */
function prepareElementForCapture(element: HTMLElement): { container: HTMLElement; cleanup: () => void } {
  const clone = cloneWithInlineStyles(element);

  // Create off-screen container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = element.scrollWidth + 'px';
  container.style.zIndex = '-1';
  container.appendChild(clone);
  document.body.appendChild(container);

  return {
    container,
    cleanup: () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  };
}

/**
 * Export DOM element as PNG image
 */
export async function exportAsImage(
  element: HTMLElement,
  options: ExportOptions = {}
): Promise<void> {
  const { filename = 'analysis-report.png' } = options;

  const { container, cleanup } = prepareElementForCapture(element);

  try {
    const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
      backgroundColor: '#0a0e17',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      // Disable animations during capture
      onclone: (clonedDoc) => {
        const style = clonedDoc.createElement('style');
        style.textContent = '* { animation: none !important; transition: none !important; }';
        clonedDoc.head.appendChild(style);
      },
    });

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('[exportAsImage] failed:', err);
    alert('图片导出失败: ' + (err instanceof Error ? err.message : String(err)));
    throw err;
  } finally {
    cleanup();
  }
}

/**
 * Export DOM element as PDF
 */
export async function exportAsPDF(
  element: HTMLElement,
  options: ExportOptions = {}
): Promise<void> {
  const {
    filename = 'analysis-report.pdf',
    title = '投资分析报告',
    stockCode,
    stockName,
  } = options;

  const { container, cleanup } = prepareElementForCapture(element);

  try {
    const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
      backgroundColor: '#0a0e17',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      onclone: (clonedDoc) => {
        const style = clonedDoc.createElement('style');
        style.textContent = '* { animation: none !important; transition: none !important; }';
        clonedDoc.head.appendChild(style);
      },
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;

    // Add title
    pdf.setFontSize(16);
    pdf.setTextColor(212, 168, 67); // gold color
    pdf.text(title, margin, margin + 5);

    // Add stock info
    if (stockCode || stockName) {
      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      const infoText = [stockCode, stockName].filter(Boolean).join(' ');
      pdf.text(infoText, margin, margin + 12);
    }

    // Add date
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, margin, margin + 18);

    // Calculate image dimensions to fit page
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin + 22;

    // Add first page
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - position);

    // Add additional pages if content overflows
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
    }

    pdf.save(filename);
  } catch (err) {
    console.error('[exportAsPDF] failed:', err);
    alert('PDF导出失败: ' + (err instanceof Error ? err.message : String(err)));
    throw err;
  } finally {
    cleanup();
  }
}

/**
 * Export analysis data as JSON
 */
export function exportAsJSON(data: unknown, filename = 'analysis-data.json'): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

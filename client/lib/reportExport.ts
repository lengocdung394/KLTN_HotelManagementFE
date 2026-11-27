import type { HotelReport } from "../services/reportApi";

type ReportExportOptions = {
  report: HotelReport;
  branchName: string;
  language: "vi" | "en";
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const formatAmount = (amount: number, language: "vi" | "en") =>
  new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);

const fileName = (extension: "xlsx" | "pdf") =>
  `bao-cao-hoat-dong-${new Date().toISOString().slice(0, 10)}.${extension}`;

const renderChart = async (
  svg: SVGSVGElement,
  legendItems: { label: string; color: string }[],
  title: string,
) => {
  const { width, height } = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const sourceNodes = [svg, ...svg.querySelectorAll("*")];
  const clonedNodes = [clone, ...clone.querySelectorAll("*")];
  const styleProperties = [
    "fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap",
    "stroke-linejoin", "fill-opacity", "stroke-opacity", "opacity",
    "font-family", "font-size", "font-weight", "text-anchor",
    "dominant-baseline", "visibility", "display", "letter-spacing",
  ];
  sourceNodes.forEach((node, index) => {
    const style = getComputedStyle(node);
    clonedNodes[index].setAttribute(
      "style",
      styleProperties.map((property) => `${property}:${style.getPropertyValue(property)}`).join(";"),
    );
  });

  const imageUrl = URL.createObjectURL(new Blob(
    [new XMLSerializer().serializeToString(clone)],
    { type: "image/svg+xml;charset=utf-8" },
  ));
  try {
    const image = new Image();
    image.src = imageUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    const scale = 2;
    const titleHeight = title ? 36 * scale : 0;
    const legendRowHeight = 24 * scale;
    canvas.width = Math.ceil(width * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create a canvas context for the chart.");
    context.font = `${13 * scale}px Arial`;
    const rows: { label: string; color: string; width: number }[][] = [];
    for (const item of legendItems) {
      const itemWidth = 12 * scale + 6 * scale + context.measureText(item.label).width + 16 * scale;
      const row = rows[rows.length - 1];
      if (!row || row.reduce((sum, entry) => sum + entry.width, 0) + itemWidth > canvas.width - 24 * scale) {
        rows.push([]);
      }
      rows[rows.length - 1].push({ ...item, width: itemWidth });
    }
    canvas.height = titleHeight + Math.ceil(height * scale)
      + (rows.length ? rows.length * legendRowHeight + 8 * scale : 0);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (title) {
      context.fillStyle = "#0f172a";
      context.font = `bold ${16 * scale}px Arial`;
      context.fillText(title, 8 * scale, 24 * scale, canvas.width - 16 * scale);
    }
    context.drawImage(image, 0, titleHeight, canvas.width, Math.ceil(height * scale));
    rows.forEach((row, rowIndex) => {
      const rowWidth = row.reduce((sum, item) => sum + item.width, 0);
      let x = (canvas.width - rowWidth) / 2;
      const y = titleHeight + Math.ceil(height * scale) + rowIndex * legendRowHeight + 8 * scale;
      row.forEach((item) => {
        context.fillStyle = item.color;
        context.beginPath();
        context.arc(x + 5 * scale, y + 6 * scale, 4 * scale, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#334155";
        context.fillText(item.label, x + 12 * scale, y + 10 * scale);
        x += item.width;
      });
    });
    return canvas;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

export async function exportReportExcel({ report, branchName, language }: ReportExportOptions) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const text = (vi: string, en: string) => language === "vi" ? vi : en;

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    [text("BÁO CÁO HOẠT ĐỘNG", "ACTIVITY REPORT")],
    [text("Chi nhánh", "Branch"), branchName],
    [text("Từ ngày", "From"), report.startDate],
    [text("Đến ngày", "To"), report.endDate],
    [],
    [text("Chỉ số", "Metric"), text("Giá trị", "Value")],
    [text("Tổng lượt đặt phòng", "Total bookings"), report.totalBookingCount ?? 0],
    [text("Booking đã hủy", "Cancelled bookings"), report.cancelledBookingCount ?? report.cancelledBookings?.length ?? 0],
    [text("Tổng số phòng", "Total rooms"), report.totalRoomCount],
    [text("Tiền phòng", "Room revenue"), report.roomRevenue],
    [text("Doanh thu dịch vụ", "Service revenue"), report.serviceRevenue],
    [text("Giá trị khuyến mãi", "Promotion savings"), report.promotionSavings],
    [text("Lượt sử dụng khuyến mãi", "Promotion uses"), report.promotionUsageCount],
    [text("Tổng tiền đã thu", "Payments received"), report.cashReceived ?? 0],
    [text("Tiền mặt đã thu", "Cash received"), report.cashReceivedCash ?? 0],
    [text("Chuyển khoản đã thu", "Bank received"), report.cashReceivedBank ?? 0],
    [text("Tổng tiền hoàn lại", "Refunds"), report.cashRefunded ?? 0],
    [text("Tiền thừa trả khách", "Change returned"), report.cashChangeReturned ?? 0],
  ]), text("Tổng quan", "Overview"));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    [text("Loại phòng", "Room type"), text("Số lượt đặt", "Bookings")],
    ...(report.roomTypeBookings ?? []).map((item) => [item.roomType, item.bookingCount]),
  ]), text("Loại phòng", "Room types"));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    [text("Trạng thái phòng", "Room status"), text("Số phòng", "Room count")],
    ...(report.roomStatuses ?? []).map((item) => [item.status, item.roomCount]),
  ]), text("Trạng thái phòng", "Room status"));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    [text("Khuyến mãi", "Promotion"), text("Mã", "Code"), text("Số lượt dùng", "Uses"), text("Giá trị giảm", "Savings")],
    ...(report.promotions ?? []).map((item) => [item.promotionName, item.promotionCode, item.usageCount, item.savings]),
  ]), text("Khuyến mãi", "Promotions"));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    [text("Mã booking", "Booking ID"), text("Kênh", "Channel"), text("Lý do", "Reason"), text("Hủy lúc", "Cancelled at")],
    ...(report.cancelledBookings ?? []).map((item) => [item.bookingId, item.bookingChannel, item.reason, item.cancelledAt ?? ""]),
  ]), text("Booking đã hủy", "Cancellations"));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    [text("Mã booking", "Booking ID"), text("Số tiền", "Amount"), text("Phương thức", "Method"), text("Trạng thái", "Status"), text("Yêu cầu lúc", "Requested at"), text("Hoàn lúc", "Refunded at")],
    ...[...(report.checkoutSurplusRefunds ?? []), ...(report.bookingCancellationRefunds ?? [])].map((item) => [
      item.bookingId,
      item.amount,
      item.paymentMethod ?? "",
      item.status ?? "",
      item.requestedAt ?? "",
      item.refundedAt ?? "",
    ]),
  ]), text("Hoàn tiền", "Refunds"));

  XLSX.writeFile(workbook, fileName("xlsx"));
}

export async function exportReportPdf({
  report,
  branchName,
  language,
  chartSections,
}: ReportExportOptions & { chartSections: HTMLElement[] }) {
  const [html2canvasModule, jspdfModule] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const html2canvas = html2canvasModule.default;
  const { jsPDF } = jspdfModule;
  const text = (vi: string, en: string) => language === "vi" ? vi : en;

  const container = document.createElement("div");
  container.style.cssText = "position:absolute;left:-10000px;top:0;width:900px;background:white;padding:32px;color:#0f172a;font-family:Arial,sans-serif;";
  container.innerHTML = `
    <h1 style="margin:0 0 8px;font-size:24px">${escapeHtml(text("BÁO CÁO HOẠT ĐỘNG", "ACTIVITY REPORT"))}</h1>
    <p style="margin:0 0 20px;color:#64748b">${escapeHtml(branchName)} · ${escapeHtml(report.startDate)} – ${escapeHtml(report.endDate)}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px">
      <tbody>
        <tr><td style="border:1px solid #e2e8f0;padding:10px">${escapeHtml(text("Tổng lượt đặt phòng", "Total bookings"))}</td><td style="border:1px solid #e2e8f0;padding:10px;font-weight:bold">${report.totalBookingCount ?? 0}</td></tr>
        <tr><td style="border:1px solid #e2e8f0;padding:10px">${escapeHtml(text("Booking đã hủy", "Cancelled bookings"))}</td><td style="border:1px solid #e2e8f0;padding:10px;font-weight:bold">${report.cancelledBookingCount ?? report.cancelledBookings?.length ?? 0}</td></tr>
        <tr><td style="border:1px solid #e2e8f0;padding:10px">${escapeHtml(text("Tiền phòng", "Room revenue"))}</td><td style="border:1px solid #e2e8f0;padding:10px;font-weight:bold">${escapeHtml(formatAmount(report.roomRevenue, language))}</td></tr>
        <tr><td style="border:1px solid #e2e8f0;padding:10px">${escapeHtml(text("Doanh thu dịch vụ", "Service revenue"))}</td><td style="border:1px solid #e2e8f0;padding:10px;font-weight:bold">${escapeHtml(formatAmount(report.serviceRevenue, language))}</td></tr>
        <tr><td style="border:1px solid #e2e8f0;padding:10px">${escapeHtml(text("Tổng tiền đã thu", "Payments received"))}</td><td style="border:1px solid #e2e8f0;padding:10px;font-weight:bold">${escapeHtml(formatAmount(report.cashReceived ?? 0, language))}</td></tr>
        <tr><td style="border:1px solid #e2e8f0;padding:10px">${escapeHtml(text("Tổng tiền hoàn lại", "Refunds"))}</td><td style="border:1px solid #e2e8f0;padding:10px;font-weight:bold">${escapeHtml(formatAmount(report.cashRefunded ?? 0, language))}</td></tr>
      </tbody>
    </table>
    <h2 style="font-size:16px;margin:20px 0 8px">${escapeHtml(text("Tình trạng phòng", "Room status"))}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr><th style="border:1px solid #e2e8f0;padding:8px;text-align:left">${escapeHtml(text("Trạng thái", "Status"))}</th><th style="border:1px solid #e2e8f0;padding:8px;text-align:left">${escapeHtml(text("Số phòng", "Rooms"))}</th></tr></thead>
      <tbody>${(report.roomStatuses ?? []).map((item) => `<tr><td style="border:1px solid #e2e8f0;padding:8px">${escapeHtml(item.status)}</td><td style="border:1px solid #e2e8f0;padding:8px">${item.roomCount}</td></tr>`).join("")}</tbody>
    </table>
    <h2 style="font-size:16px;margin:20px 0 8px">${escapeHtml(text("Booking đã hủy", "Cancelled bookings"))}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr><th style="border:1px solid #e2e8f0;padding:8px;text-align:left">ID</th><th style="border:1px solid #e2e8f0;padding:8px;text-align:left">${escapeHtml(text("Kênh", "Channel"))}</th><th style="border:1px solid #e2e8f0;padding:8px;text-align:left">${escapeHtml(text("Lý do", "Reason"))}</th></tr></thead>
      <tbody>${(report.cancelledBookings ?? []).map((item) => `<tr><td style="border:1px solid #e2e8f0;padding:8px">${escapeHtml(item.bookingId)}</td><td style="border:1px solid #e2e8f0;padding:8px">${escapeHtml(item.bookingChannel)}</td><td style="border:1px solid #e2e8f0;padding:8px">${escapeHtml(item.reason)}</td></tr>`).join("")}</tbody>
    </table>
  `;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageHeight = canvas.height * (pageWidth / canvas.width);
    const charts: { title: string; canvas: HTMLCanvasElement }[] = [];
    for (const section of chartSections) {
      const svg = [...section.querySelectorAll<SVGSVGElement>("svg.recharts-surface")]
        .filter((item) => item.getBoundingClientRect().width > 100)
        .sort((left, right) => {
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          return rightRect.width * rightRect.height - leftRect.width * leftRect.height;
        })[0];
      if (!svg) continue;

      const legendItems = [...section.querySelectorAll<HTMLElement>(".recharts-legend-item")]
        .map((item) => {
          const marker = item.querySelector("svg path");
          const markerColor = marker?.getAttribute("fill");
          return {
            label: item.textContent?.trim() ?? "",
            color: markerColor && markerColor !== "none"
              ? markerColor
              : marker?.getAttribute("stroke") ?? "#64748b",
          };
        })
        .filter((item) => item.label);
      const title = section.querySelector("h3")?.textContent?.trim() ?? "";
      charts.push({
        title,
        canvas: await renderChart(svg, legendItems, title),
      });
    }

    const chartGroups: typeof charts[] = [];
    for (let index = 0; index < charts.length;) {
      const remaining = charts.length - index;
      const groupSize = remaining > 3 ? 2 : remaining;
      chartGroups.push(charts.slice(index, index + groupSize));
      index += groupSize;
    }
    const summaryPageCount = Math.max(1, Math.ceil(imageHeight / pageHeight));
    const contents = [
      { title: text("Tổng quan", "Overview"), page: 2 },
      ...chartGroups.flatMap((group, index) => group.map((chart) => ({
        title: chart.title,
        page: 2 + summaryPageCount + index,
      }))),
    ];
    const contentsCanvas = document.createElement("canvas");
    contentsCanvas.width = 1240;
    contentsCanvas.height = 1754;
    const contentsContext = contentsCanvas.getContext("2d");
    if (!contentsContext) throw new Error("Could not create a canvas context for the table of contents.");
    contentsContext.fillStyle = "#ffffff";
    contentsContext.fillRect(0, 0, contentsCanvas.width, contentsCanvas.height);
    contentsContext.fillStyle = "#0f172a";
    contentsContext.font = "bold 44px Arial";
    contentsContext.fillText(text("MỤC LỤC BÁO CÁO", "REPORT CONTENTS"), 88, 170);
    contentsContext.fillStyle = "#64748b";
    contentsContext.font = "24px Arial";
    contentsContext.fillText(`${branchName} · ${report.startDate} – ${report.endDate}`, 88, 220);
    contentsContext.fillStyle = "#0f172a";
    contentsContext.font = "bold 28px Arial";
    contentsContext.fillText(text("Nội dung", "Contents"), 88, 330);
    contentsContext.fillText(text("Trang", "Page"), 1080, 330);
    contentsContext.strokeStyle = "#e2e8f0";
    contentsContext.beginPath();
    contentsContext.moveTo(88, 350);
    contentsContext.lineTo(1152, 350);
    contentsContext.stroke();
    const contentsRows = contents.map((entry, index) => ({
      ...entry,
      y: 420 + index * 100,
    }));
    contentsRows.forEach((entry) => {
      contentsContext.fillStyle = "#1e40af";
      contentsContext.font = "24px Arial";
      contentsContext.fillText(entry.title, 88, entry.y, 900);
      contentsContext.fillStyle = "#334155";
      contentsContext.textAlign = "right";
      contentsContext.fillText(String(entry.page), 1152, entry.y);
      contentsContext.textAlign = "left";
      contentsContext.strokeStyle = "#e2e8f0";
      contentsContext.beginPath();
      contentsContext.moveTo(88, entry.y + 24);
      contentsContext.lineTo(1152, entry.y + 24);
      contentsContext.stroke();
    });

    pdf.addImage(contentsCanvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pageWidth, pageHeight);

    for (let page = 0; page < summaryPageCount; page++) {
      pdf.addPage();
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0,
        -page * pageHeight,
        pageWidth,
        imageHeight,
      );
    }

    for (const group of chartGroups) {
      pdf.addPage();
      const topMargin = 12;
      const slotHeight = (pageHeight - 24) / group.length;
      group.forEach((chart, index) => {
        const slotTop = topMargin + index * slotHeight;
        const maxWidth = pageWidth - 20;
        const maxHeight = slotHeight - 14;
        const scale = Math.min(maxWidth / chart.canvas.width, maxHeight / chart.canvas.height);
        const imageWidth = chart.canvas.width * scale;
        const imageHeight = chart.canvas.height * scale;
        pdf.addImage(
          chart.canvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          (pageWidth - imageWidth) / 2,
          slotTop + (slotHeight - imageHeight) / 2,
          imageWidth,
          imageHeight,
        );
      });
    }

    pdf.setPage(1);
    contentsRows.forEach((entry) => {
      const linkTop = (entry.y - 32) * pageHeight / contentsCanvas.height;
      pdf.link(14, linkTop, pageWidth - 28, 12, { pageNumber: entry.page });
    });
    for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
      pdf.setPage(page);
      pdf.setFontSize(8);
      pdf.setTextColor("#64748b");
      pdf.text(String(page), pageWidth - 8, pageHeight - 5, { align: "right" });
    }
    pdf.save(fileName("pdf"));
  } finally {
    container.remove();
  }
}

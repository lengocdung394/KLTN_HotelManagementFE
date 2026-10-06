import { createXlsxWorkbook, downloadFile } from "./bulkImportFiles";

export const downloadAmenityTemplate = () => {
  const workbook = createXlsxWorkbook([
    {
      name: "Tiện ích",
      rows: [
        ["Tên tiện ích", "Giá tiền"],
        ["Wifi tốc độ cao (Ví dụ)", 0],
      ],
    },
    {
      name: "Hướng dẫn",
      rows: [
        ["HƯỚNG DẪN NHẬP TIỆN ÍCH"],
        ["Mỗi dòng trong sheet Tiện ích là một tiện ích mới."],
        ["Nhập tên tiện ích và giá tiền không âm; không đổi tên hai cột Tên tiện ích, Giá tiền."],
        ["Giá tiền nhập bằng số, không thêm ký hiệu tiền tệ. Ví dụ: 50000."],
        ["Các tiện ích trùng tên với danh sách hiện có sẽ được bỏ qua."],
        ["Dữ liệu tiện nghi hợp lệ sẽ được lưu vào cơ sở dữ liệu của hệ thống."],
      ],
    },
  ]);
  downloadFile("mau-nhap-tien-ich.xlsx", workbook);
};

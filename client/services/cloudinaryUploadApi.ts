const MAX_ROOM_IMAGE_BYTES = 5 * 1024 * 1024;

type CloudinaryUploadResponse = {
  secure_url?: string;
  error?: { message?: string };
};

const getCloudinaryConfig = () => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloudName || !uploadPreset) {
    throw new Error("Thiếu cấu hình VITE_CLOUDINARY_CLOUD_NAME hoặc VITE_CLOUDINARY_UPLOAD_PRESET.");
  }
  return { cloudName, uploadPreset };
};

const getBranchImageFolder = (branchName: string, category: "rooms" | "services") => {
  const normalized = branchName.trim().normalize("NFD");
  const slug = normalized
    .replace(/[\u0300-\u036f]+/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-");

  if (!slug) throw new Error("Không xác định được tên chi nhánh để lưu ảnh phòng.");
  return `hotel-management/branches/${slug}/${category}`;
};

const uploadImage = async (file: File, cloudName: string, uploadPreset: string, folder: string) => {
  if (file.size > MAX_ROOM_IMAGE_BYTES) {
    throw new Error(`Ảnh "${file.name}" vượt quá giới hạn 5 MB.`);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await response.json() as CloudinaryUploadResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `Cloudinary từ chối ảnh "${file.name}" (HTTP ${response.status}).`);
  }
  if (!data.secure_url || !data.secure_url.startsWith("https://res.cloudinary.com/")) {
    throw new Error(`Cloudinary không trả về URL HTTPS hợp lệ cho ảnh "${file.name}".`);
  }
  return data.secure_url;
};

export const uploadImagesToCloudinary = async (
  files: File[],
  branchName: string,
  category: "rooms" | "services",
  onProgress?: (uploaded: number, total: number) => void,
) => {
  const { cloudName, uploadPreset } = getCloudinaryConfig();
  const folder = getBranchImageFolder(branchName, category);
  const uniqueFiles = [...new Map(files.map((file) => [file.name.toLocaleLowerCase(), file])).values()];
  const urlsByFileName = new Map<string, string>();
  let nextIndex = 0;
  let uploadedCount = 0;

  const uploadNext = async () => {
    while (nextIndex < uniqueFiles.length) {
      const index = nextIndex;
      nextIndex += 1;
      const file = uniqueFiles[index];
      const url = await uploadImage(file, cloudName, uploadPreset, folder);
      urlsByFileName.set(file.name.toLocaleLowerCase(), url);
      uploadedCount += 1;
      onProgress?.(uploadedCount, uniqueFiles.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(3, uniqueFiles.length) }, () => uploadNext()));
  return urlsByFileName;
};

export const uploadRoomImagesToCloudinary = (
  files: File[],
  branchName: string,
  onProgress?: (uploaded: number, total: number) => void,
) => uploadImagesToCloudinary(files, branchName, "rooms", onProgress);

export const uploadServiceImagesToCloudinary = (
  files: File[],
  branchName: string,
  onProgress?: (uploaded: number, total: number) => void,
) => uploadImagesToCloudinary(files, branchName, "services", onProgress);

export const uploadProvinceBackgroundToCloudinary = async (file: File, provinceName: string) => {
  const normalized = provinceName.trim().normalize("NFD");
  const slug = normalized
    .replace(/[\u0300-\u036f]+/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) throw new Error("Vui lòng nhập tên tỉnh/thành hợp lệ trước khi tải ảnh.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Ảnh nền chỉ chấp nhận định dạng JPG, PNG hoặc WebP.");
  }

  const { cloudName, uploadPreset } = getCloudinaryConfig();
  return uploadImage(file, cloudName, uploadPreset, `hotel-management/provinces/${slug}/background`);
};

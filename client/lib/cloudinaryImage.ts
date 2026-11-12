export function optimizeCloudinaryImage(url: string, width: number) {
  if (!url.startsWith("https://res.cloudinary.com/")) return url;
  return url.replace(
    /\/upload\//,
    `/upload/f_auto,q_auto:best,c_limit,w_${width}/`,
  );
}

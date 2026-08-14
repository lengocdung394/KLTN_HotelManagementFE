
import './globals.css';
import Header from '../components/Header'; // hoặc từ packages/ui

export const metadata = {
  title: 'Aurora Guest Portal',
  description: 'Hotel Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-slate-50 min-h-screen">
        {/* 1. Header cố định ở trên cùng cho toàn bộ app */}
        <Header />

        {/* 2. Nội dung các trang sẽ thay đổi ở đây */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
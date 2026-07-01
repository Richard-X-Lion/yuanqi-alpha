import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '元启Alpha | 多智能体投资决策系统',
  description: '基于多AI Agent辩论协商的A股智能投资决策系统，融合基本面、情绪面、资金面三维分析',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}

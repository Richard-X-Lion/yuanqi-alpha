import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';

const title = '元启Alpha | 多智能体投资决策系统';
const description = '覆盖A股、港股和美股的多智能体投资研究系统，通过独立分析、辩论和置信度加权形成证据驱动的决策参考。';

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  const origin = host ? `${protocol}://${host}` : 'http://localhost:5000';
  const socialImage = new URL('/og.png', origin).toString();

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: socialImage, width: 1200, height: 630, alt: '元启Alpha 多智能体投资决策系统' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [socialImage],
    },
  };
}

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

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { company } from '@/config/company';

export const alt = '951 Express Inc: licensed and bonded auto transport';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The social-sharing card: navy, the logo, the headline, and the facts we can state.
export default async function OpengraphImage() {
  const logo = await readFile(path.join(process.cwd(), 'public/images/logos/logo-og.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        background: 'linear-gradient(135deg, #0E1A2B 0%, #1D3B60 100%)',
        color: '#fff',
      }}
    >
      <img src={logoSrc} alt={company.logo.alt} width={660} height={279} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>
          Your vehicle, delivered safely and on schedule.
        </div>
        <div style={{ marginTop: 28, fontSize: 30, color: '#C9D3E2' }}>
          {`USDOT ${company.usdot} · ${company.mc} · Corona, CA`}
        </div>
      </div>
    </div>,
    size,
  );
}

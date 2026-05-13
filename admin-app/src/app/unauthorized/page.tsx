export default function UnauthorizedPage() {
  const mainSiteUrl = process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? '/'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0f9f4',
      fontFamily: 'Mulish, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '48px 36px',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 12px 48px rgba(15,40,24,.12)',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🔒</div>
        <h1 style={{ fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: '#0f2818', margin: '0 0 10px' }}>
          Немає доступу
        </h1>
        <p style={{ color: '#3f7558', fontSize: '14px', lineHeight: '1.6', margin: '0 0 28px' }}>
          Ця сторінка доступна тільки адміністраторам.<br />
          Увійдіть через головний сайт з акаунтом адміна.
        </p>
        <a
          href={mainSiteUrl}
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            background: '#4ab584',
            color: '#fff',
            borderRadius: '12px',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '15px',
          }}
        >
          На головний сайт
        </a>
      </div>
    </div>
  )
}

/**
 * Protège tout le site derrière une authentification HTTP Basic, gérée par
 * Vercel Edge Middleware (gratuit, aucun plan payant requis).
 *
 * N'agit que si BASIC_AUTH_USER et BASIC_AUTH_PASSWORD sont définis dans les
 * variables d'environnement du projet Vercel — sans ces deux variables, le
 * site reste accessible sans mot de passe (utile en local / pour un aperçu).
 *
 * Voir README.md, section "Sécuriser le lien".
 */

export const config = {
  matcher: '/((?!favicon.ico).*)',
};

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export default function middleware(request: Request): Response | undefined {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;
  if (!expectedUser || !expectedPassword) return undefined;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Basic ')) {
    try {
      const decoded = atob(authHeader.slice('Basic '.length));
      const separatorIndex = decoded.indexOf(':');
      const user = decoded.slice(0, separatorIndex);
      const password = decoded.slice(separatorIndex + 1);
      if (safeEqual(user, expectedUser) && safeEqual(password, expectedPassword)) {
        return undefined;
      }
    } catch {
      // en-tête malformé — traité comme non authentifié ci-dessous
    }
  }

  return new Response('Authentification requise.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Hostivo CRM"' },
  });
}

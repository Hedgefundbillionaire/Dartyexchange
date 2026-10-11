export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/resultat', '/resultat/', '/admin', '/admin/', '/espace', '/espace/', '/api/'],
      },
    ],
  };
}

export const metadata = {
  title: 'DartySwap',
  description: 'Échange de Darty entre étudiants HEC.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}

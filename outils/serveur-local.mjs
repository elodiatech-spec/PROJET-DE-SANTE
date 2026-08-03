/**
 * Petit serveur statique pour essayer l'application en local.
 *
 *   node outils/serveur-local.mjs        → http://localhost:4173
 *   node outils/serveur-local.mjs 8080   → autre port
 *
 * Aucune dépendance. Sert uniquement les fichiers du dépôt.
 * Pour la mise en ligne réelle, c'est GitHub Pages qui s'en charge.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
};

createServer(async (requete, reponse) => {
  let chemin = decodeURIComponent(new URL(requete.url, 'http://local').pathname);
  if (chemin === '/' || chemin.endsWith('/')) chemin += 'index.html';

  // On ne sort jamais du dossier du dépôt.
  const fichier = join(RACINE, normalize(chemin).replace(/^(\.\.[/\\])+/, ''));
  if (!fichier.startsWith(RACINE)) {
    reponse.writeHead(403).end('403');
    return;
  }

  try {
    const contenu = await readFile(fichier);
    reponse.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] || 'application/octet-stream' });
    reponse.end(contenu);
  } catch {
    reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    reponse.end('Fichier introuvable');
  }
}).listen(PORT, () => {
  console.log(`Plateforme ElodiaTech — http://localhost:${PORT}`);
});

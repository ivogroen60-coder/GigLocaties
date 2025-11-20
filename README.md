# GigMap — Live Music Venues (GitHub Pages)

This repository is a static website built for GitHub Pages that:
- loads a CSV of venues (`data/venues-updated.csv`) containing `latitude,longitude,name,email`
- displays markers on a Google Map
- fetches venue photos via Google Places API (requires API key)
- provides a manual genre dropdown you can manage in the UI
- allows editing a venue's genre in the browser and downloading an updated CSV

## Deploy
1. Unzip these files into your repository root.
2. Ensure `data/venues-updated.csv` exists (included here, converted from your CSV).
3. Create a file named `.nojekyll` in the repo root (already included).
4. In GitHub repo Settings → Pages select branch `main` and folder `/ (root)`.
5. Restrict your Google API key to your GitHub Pages domain in Google Cloud Console.

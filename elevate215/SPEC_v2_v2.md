# Elevate 215 — Upload Page Spec

## Part 1 — Upload page
Input: Priya or Renée picks the forecast or grant commitments tab, chooses an .xlsx file, types their name and clicks Upload.
Output: The page shows "Saved version N: X rows", or the reason the file was rejected plus a short tip on what to fix. Nothing is saved for a rejected file.
Done when: The page is built and works with the app_v2 backend, and tests that upload good and broken mock files through the page pass.

## Part 2 — Version history
Input: Someone opens either tab.
Output: A list of past versions, newest first, showing version, date, who uploaded it, file name and row count, plus a Download button that gives back the original .xlsx.
Done when: The list shows the right versions after each upload, Download returns the same file that was uploaded, and tests checking both pass.

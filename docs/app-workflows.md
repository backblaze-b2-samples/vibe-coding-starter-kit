# App Workflows

## View Dashboard

- User navigates to `/`
- System displays stats cards (total files, storage used, uploads today)
- System displays upload activity bar chart (last 7 days)
- System displays recent uploads table (last 10 files)

## Upload Files

- User navigates to `/upload`
- User drags files into dropzone or clicks to browse
- System validates file size (max 100MB) and type
- System uploads each file with real-time progress bar
- System shows success/error toast per file
- On success, system returns file metadata (size, type, checksums, image dimensions, PDF info)
- User can clear completed uploads

## Browse Files

- User navigates to `/files`
- System lists all files with filename, size, type, upload date
- User clicks action menu on a file row
- User can preview (images inline, PDFs in iframe, others show metadata)
- User can download (presigned URL opens in new tab)
- User can delete (file removed from B2, row removed from table)
- User can refresh the file list

## Toggle Dark Mode

- User clicks moon/sun icon in header
- System toggles between light and dark themes
- Preference persists across page loads

## Related Docs

- [File Upload](features/file-upload.md)
- [File Browser](features/file-browser.md)
- [Dashboard](features/dashboard.md)
- [Metadata Extraction](features/metadata-extraction.md)

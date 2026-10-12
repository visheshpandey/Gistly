# Data folder

- `feedback.csv`: the built-in sample dataset (columns `review`, `category`, 7,000 rows). The app reads it on the server and shows it on first load.
- `analysis-sample.json`: a real AI analysis of the sample (labels, themes, suggested actions), made with `node scripts/analyse-sample.ts --save`. It lets the demo show results with no AI call. Re-make it if the labelling prompt changes.
- `adaption-sample.json`: the real result of one Adaption run on a sample of the dataset (quality grade and score, rows kept), read from Adaption itself.

These are real outputs, not hand-written numbers. To use your own data, upload a CSV on the Feedback page instead of editing these files.

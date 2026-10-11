# Data folder

The app reads `data/feedback.csv` on the server. The file needs two columns: `review` and `category`.

Copy the provided dataset into place (Windows PowerShell, from the project folder):

```powershell
Copy-Item "C:\Users\Janhavi Pandey\Downloads\BuildBattle_2026_Customer_Feedback_Dataset.csv" .\data\feedback.csv
```

Identical rows (same review and category) are grouped and shown with an Occurrences count.
The file has no dates, so no time-based data is shown.

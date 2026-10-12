# Club Registration Form

Only 1st, 2nd and 3rd year students can register. Selecting Yes for Japanese student shows only Japanese Club, which has unlimited seats and a separate registration tab. Selecting No shows the 10 regular clubs in the screenshot order. AWS is no longer asked; the legacy AWS Interest column is retained for existing records and left blank for new submissions. Regular-club year quotas and department limits are unchanged; Year 4 allocations are retained as historical source data, without reallocating those seats.

## Google Sheets connection

The project is prepared for the Google Sheet `1jTPb8S7mVIJfwmRuNJf_eyaj5S7ytZKKGNgyBSWV5Xk`.

The GitHub source excludes student registration files, screenshots and private Google connection credentials. On a fresh checkout, starting the server creates an empty Excel workbook and a new private Google connection key. Configure its generated Apps Script code and verify the deployment through /setup to enable Google saving on that computer. This computer's existing Google connection remains active.

Open `http://localhost:8000/setup` for connection instructions. In the sheet owner's Google account, choose Extensions → Apps Script, paste the private `google-sheets/Code.gs` from this project, and save. Deploy as a Web app executing as Me, with access set to Anyone. Authorize Google Sheets access. Paste the resulting /exec URL into the setup page and click Verify and connect.

The endpoint requires a private connection token; its URL alone does not allow reading or writing registrations. Keep `google-sheets/connection.json` and the generated `google-sheets/Code.gs` private. Neither is served by the registration server. A portable project ZIP includes the token-free template; private generated files stay on this computer.

The server switches to Google Sheets only after a successful verification of the exact spreadsheet and all clubs. Until activation, the form continues saving to local Excel and displays Connected to Excel. After activation, it displays Connected to Google Sheets and reads seat availability from that sheet. All submissions save to the corresponding club tab. Cloud failures show an error without falling back to Excel. Retrying an unconfirmed request uses the same confirmation ID to prevent duplicate rows. The Google connection does not synchronize older local Excel records automatically.

The Google deployment is authorized and active on this computer. Saving through the form server has been verified against the live spreadsheet, and four earlier Excel registrations have been migrated with their original dates. The private connection settings are stored in this folder; portable ZIP copies require their own connection setup. Existing sheet tabs and records are preserved.

Double-click **Start.bat**, keep the terminal open, then visit **http://localhost:8000**. The form uses HTML, CSS and JavaScript. A small Python server writes registrations directly to `data/Club_Registrations.xlsx`.

On another computer, install Python 3.10 or newer, run `python -m pip install -r requirements.txt`, and then `python server.py`.

The workbook contains separate tabs for the 10 regular clubs and Japanese Club. Each club tab starts with student details in row 1: Name, Register Number, Official college mail id, Phone, Department, Year, Japanese Student, AWS Interest (legacy), Club, Status, Confirmation ID and Registration Date. New registrations start in row 2. Status is saved as Registered, the confirmation ID is generated automatically and the date is recorded in IST. New AWS Interest values are blank; the form does not ask about AWS. The Allocations tab shows allocated, registered and remaining seats by department/year for regular clubs. The IBM community tab is named `IBM Z Explore` to fit Excel's 31-character tab-name limit. The Communication Club card uses the screenshot's LEXORA label; its allocation maps to Communication Club in the supplied workbook.

The confirmed 150-seat scenario is loaded from the supplied Year-wise sheet. The server checks year quotas, department totals and the 150-seat club maximum before saving. Register numbers and college emails are unique across all clubs. Official emails must end in @mkce.ac.in. Japanese student status is recorded without adding an eligibility restriction.

Close the workbook in Excel while accepting registrations so Excel does not lock it. Open it after submissions to inspect the records; Excel recalculates its registered/remaining formulas when opened. The form counts records directly and refreshes availability every 30 seconds and after submissions.

Edit seat limits in the Allocations tab, columns A–E, retaining all 400 unique club/department/year rows. Columns F–G calculate registered and remaining counts. The server reloads limits for each request. Preserve row 1 of club tabs and the registration column order. Each club has a filterable table with space for 150 student registrations.

This version runs on this computer at localhost. Online or campus-wide registration requires hosting the server with suitable access controls and a shared datastore. The Excel file is kept server-side and cannot be downloaded through the public form endpoints.

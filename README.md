# Firestore Auto Sync (Multi-Sheet)

ดึงข้อมูลจากแท็บ **Drivers / Assignments / Pickup** บน Google Sheet → เขียนลง Firestore อัตโนมัติ ผ่าน GitHub Actions หรือรันเองได้

## Tabs ที่รองรับ
- `Drivers` : ต้องมีคอลัมน์ `Driver ID`, `Driver Name`, `IDShift`, `TimeHolidayDate`
- `Assignments` : ต้องมีคอลัมน์ `Driver ID`, `Pickup Point ID`
- `Pickup` : ต้องมีคอลัมน์ `Group Name`, `Pickup Point ID`, `Pickup Point Name`, `Text Address`

> ℹ️ สคริปต์จะตรวจสอบคอลัมน์ที่จำเป็นให้ครบก่อนซิงก์ หากขาดคอลัมน์ใดจะหยุดการทำงานและแจ้งชื่อคอลัมน์ที่หายไป

## ใช้กับ GitHub Actions
1) อัปโหลดไฟล์ทั้งหมดขึ้น GitHub repo
2) เพิ่ม Secrets ที่ Settings → Secrets → Actions
   - `GOOGLE_API_KEY`
   - `SHEET_ID`
   - `FIREBASE_SERVICE_ACCOUNT` (ทั้ง JSON)
   - (ถ้าจะเปลี่ยนชื่อแท็บ) `TAB_DRIVERS`, `TAB_ASSIGNMENTS`, `TAB_PICKUP`
3) เปิดแท็บ **Actions** แล้วกด **Run workflow**

## รันบนเครื่อง/Cloud Shell
```bash
npm install
# ใส่ .env เอง หรือใช้ export env ให้เหมือนกับ Secrets ได้
npm run sync
```

## เขียนแบบ upsert
สคริปต์จะ **merge** เอกสารด้วย id เดิม (ไม่ลบทิ้ง) :
- `drivers/{Driver ID}`
- `pickups/{Pickup Point ID}`
- `assignments/{Driver ID}__{Pickup Point ID}`

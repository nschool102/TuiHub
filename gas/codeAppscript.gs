// sửa dữ liệu cũ bị sai định dạng ngày tháng (chạy 1 lần để dọn dữ liệu cũ bị Sheets tự convert thành Date)
function fixTimestampFormat() {
  fixDateColumnToText_("TRANSACTIONS", "A");
  fixDateColumnToText_("REMINDERS", "C");
  fixDateColumnToText_("REMINDERS", "E");
  fixDateColumnToText_("REMINDERS", "F");
}

function fixDateColumnToText_(sheetName, columnLetter) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    Logger.log("❌ Không tìm thấy sheet " + sheetName);
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var range = sheet.getRange(columnLetter + "2:" + columnLetter + lastRow);
  var values = range.getValues();

  var newValues = values.map(function(row) {
    var val = row[0];
    if (val instanceof Date) {
      return [formatVietnamDateTime(val)];
    }
    return [val];
  });

  // Ép cả cột thành Plain Text TRƯỚC khi set, để Sheets không convert lại thành Date
  range.setNumberFormat("@STRING@");
  range.setValues(newValues);
  Logger.log("✅ " + sheetName + " [" + columnLetter + "]: Đã sửa " + newValues.length + " dòng");
}

function testWriteDirect() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("TRANSACTIONS");
  
  if (!sheet) {
    Logger.log("❌ KHÔNG TÌM THẤY SHEET TRANSACTIONS");
    return "Sheet not found";
  }
  
  Logger.log("✅ Tìm thấy sheet: " + sheet.getName());
  Logger.log("📊 Số dòng hiện tại: " + sheet.getLastRow());
  
  // Thử ghi 1 dòng
  try {
    sheet.appendRow([
      "2026-06-27 14:30",
      "Test Direct",
      "Test Subtype",
      1000000,
      "Test from Apps Script"
    ]);
    Logger.log("✅ Đã ghi xong. Số dòng mới: " + sheet.getLastRow());
    return "Success";
  } catch(e) {
    Logger.log("❌ Lỗi ghi: " + e.toString());
    return "Error: " + e.toString();
  }
}

// =========================================================================
// KHAI BÁO TÊN SHEETS THỰC TẾ
// =========================================================================
const SHEETS_CONFIG = {
  TRANSACTIONS: "TRANSACTIONS",
  REMINDERS: "REMINDERS",
  FAMILY: "FAMILY",
  CONFIG_APP: "CONFIG_APP",
  DIARY: "DIARY",
  HEALTH: "HEALTH CHECK"
};

// =========================================================================
// HÀM XỬ LÝ NGÀY THÁNG CHO VIỆT NAM (GMT+7)
// =========================================================================

// Format Date thành chuỗi yyyy-mm-dd hh:mm:ss theo GMT+7
function formatVietnamDateTime(dateInput) {
  if (!dateInput) return '';
  
  var d;
  if (dateInput instanceof Date) {
    d = new Date(dateInput);
  } else {
    d = new Date(dateInput);
  }
  
  if (isNaN(d.getTime())) {
    Logger.log("⚠️ formatVietnamDateTime: Invalid date input: " + dateInput);
    return '';
  }
  
  // Chuyển về GMT+7
  var offset = d.getTimezoneOffset();
  var vietnamTime = new Date(d.getTime() + (offset + 420) * 60000);
  
  var year = vietnamTime.getFullYear();
  var month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
  var day = String(vietnamTime.getDate()).padStart(2, '0');
  var hours = String(vietnamTime.getHours()).padStart(2, '0');
  var minutes = String(vietnamTime.getMinutes()).padStart(2, '0');
  
  var result = year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;
  Logger.log("✅ formatVietnamDateTime: " + dateInput + " → " + result);
  return result;
} // end function formatVietnamDateTime

// Format datetime cho Diary: dd-mm-yyyy HH:mm:ss
function formatDiaryDateTime(dateInput) {
  if (!dateInput) return '';
  
  var d;
  if (dateInput instanceof Date) {
    d = new Date(dateInput);
  } else {
    d = new Date(dateInput);
  }
  
  if (isNaN(d.getTime())) {
    Logger.log("⚠️ formatDiaryDateTime: Invalid date input: " + dateInput);
    return '';
  }
  
  // Chuyển về GMT+7
  var offset = d.getTimezoneOffset();
  var vietnamTime = new Date(d.getTime() + (offset + 420) * 60000);
  
  var day = String(vietnamTime.getDate()).padStart(2, '0');
  var month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
  var year = vietnamTime.getFullYear();
  var hours = String(vietnamTime.getHours()).padStart(2, '0');
  var minutes = String(vietnamTime.getMinutes()).padStart(2, '0');
  var seconds = String(vietnamTime.getSeconds()).padStart(2, '0');
  
  var result = day + '-' + month + '-' + year + ' ' + hours + ':' + minutes + ':' + seconds;
  Logger.log("✅ formatDiaryDateTime: " + dateInput + " → " + result);
  return result;
} // end function formatDiaryDateTime

// Format datetime cho Health: dd/mm/yyyy hh:mm
function formatHealthDateTime(dateInput) {
  if (!dateInput) return '';
  
  var d;
  if (dateInput instanceof Date) {
    d = new Date(dateInput);
  } else {
    d = new Date(dateInput);
  }
  
  if (isNaN(d.getTime())) {
    Logger.log("⚠️ formatHealthDateTime: Invalid date input: " + dateInput);
    return '';
  }
  
  // Chuyển về GMT+7
  var offset = d.getTimezoneOffset();
  var vietnamTime = new Date(d.getTime() + (offset + 420) * 60000);
  
  var day = String(vietnamTime.getDate()).padStart(2, '0');
  var month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
  var year = vietnamTime.getFullYear();
  var hours = String(vietnamTime.getHours()).padStart(2, '0');
  var minutes = String(vietnamTime.getMinutes()).padStart(2, '0');
  
  return day + '/' + month + '/' + year + ' ' + hours + ':' + minutes;
} // end function formatHealthDateTime

// [HUB] Trả về Date object THẬT (Date value / serial number), dùng để ghi vào Sheet
// thay cho ép Plain Text — để dùng được trong SUMIFS/COUNTIFS/cộng trừ ngày.
//
// QUAN TRỌNG: mỗi loại dữ liệu gửi lên 1 định dạng chuỗi khác nhau:
//   - Giao dịch Thu/Chi & Nhắc hẹn: "yyyy-mm-dd hh:mm" (formatVietnamDateTime, ISO, Date() parse được)
//   - Nhật kí:  "dd-mm-yyyy hh:mm:ss" (formatDiaryDateTime — KHÔNG parse được bằng new Date())
//   - Health:   "dd/mm/yyyy hh:mm"   (formatHealthDateTime — KHÔNG parse được bằng new Date())
// new Date("16-07-2026 13:31:00") / new Date("16/07/2026 13:31") đều trả về Invalid Date,
// nên phải tự tách ngày/giờ bằng regex theo từng định dạng thay vì phó mặc cho Date() đoán.
//
// Các thành phần ngày/giờ tách ra được coi là GIỜ VIỆT NAM (vì đã tự quy đổi GMT+7 trước khi
// format thành chuỗi), nên dùng new Date(năm, tháng, ngày, giờ, phút, giây) — Date constructor
// kiểu "component" này tạo giờ theo timezone của chính Apps Script project. Múi giờ project CẦN
// được đặt là "(GMT+07:00) Bangkok/Hanoi/Jakarta" (File ▸ Project properties ▸ Time zone) để
// giá trị ghi vào Sheet đúng bằng giờ Việt Nam như đã nhập.
function toVietnamDateObject(dateInput) {
  if (!dateInput) return null;

  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  var s = String(dateInput).trim();
  var m;

  // yyyy-mm-dd hh:mm[:ss] hoặc yyyy-mm-ddThh:mm[:ss]
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(:(\d{2}))?/);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[7] || 0));
  }

  // yyyy-mm-dd (chỉ ngày)
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  // dd-mm-yyyy hh:mm[:ss] (Nhật kí)
  m = s.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})(:(\d{2}))?/);
  if (m) {
    return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[7] || 0));
  }

  // dd/mm/yyyy hh:mm (Health)
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
  if (m) {
    return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], 0);
  }

  // dd/mm/yyyy hoặc dd-mm-yyyy (chỉ ngày)
  m = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (m) {
    return new Date(+m[3], +m[2] - 1, +m[1]);
  }

  // Fallback cuối: để JS tự đoán (vd chuỗi ISO có "Z"/offset, hoặc timestamp số)
  var fallback = new Date(dateInput);
  if (!isNaN(fallback.getTime())) return fallback;

  Logger.log("⚠️ toVietnamDateObject: Không parse được chuỗi ngày: " + dateInput);
  return null;
} // end function toVietnamDateObject

// =========================================================================
// 1. HÀM ĐIỀU PHỐI CHÍNH (MAIN ROUTERS)
// =========================================================================

function doGet(e) {
  Logger.log("📥 doGet called with params: " + JSON.stringify(e.parameter));
  
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var responseData;
  
  try {
    if (action === "getAllAppData") {
      Logger.log("📊 Action: getAllAppData");
      responseData = getAppDataAction(ss);
    } 
    else if (action === "checkResetPassword") {
      var password = e.parameter.password;
      Logger.log("🔐 Action: checkResetPassword");
      responseData = checkPasswordAction(ss, password);
    } 
    else if (action === "getFamilyData") {
      Logger.log("👨‍👩‍👧‍👦 Action: getFamilyData");
      responseData = getFamilyDataAction(ss);
    }
    else if (action === "getDiaryData") {
      Logger.log("📝 Action: getDiaryData");
      responseData = getDiaryDataAction(ss);
    }
    else if (action === "getHealthData") {
      Logger.log("🏥 Action: getHealthData");
      responseData = getHealthDataAction(ss);
    }
    else {
      Logger.log("❌ Unknown action: " + action);
      responseData = { status: "error", message: "Hành động không hợp lệ: " + action };
    }
  } catch (err) {
    Logger.log("❌ doGet ERROR: " + err.toString());
    responseData = { status: "error", message: err.toString() };
  }
  
  Logger.log("📤 doGet response: " + JSON.stringify(responseData));
  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
} // end function doGet

function doPost(e) {
  Logger.log("📥 doPost called");
  Logger.log("📥 e.parameter: " + JSON.stringify(e.parameter));
  
  var responseData;
  try {
    var params = e.parameter;
    if (e.postData && e.postData.contents) {
      Logger.log("📥 e.postData.contents: " + e.postData.contents);
      params = JSON.parse(e.postData.contents);
      Logger.log("📥 Parsed params: " + JSON.stringify(params));
    }
    
    var action = params.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    Logger.log("🎯 Action: " + action);
    Logger.log("📦 Data: " + JSON.stringify(params.data));
    
    if (action === "saveTransaction") {
      Logger.log("💾 Action: saveTransaction");
      responseData = saveTransactionAction(ss, params);
    } 
    else if (action === "saveReminder") {
      Logger.log("⏰ Action: saveReminder");
      responseData = saveReminderAction(ss, params);
    }
    else if (action === "syncReminders") {
      Logger.log("🔄 Action: syncReminders");
      responseData = syncRemindersAction(ss, params);
    }
    else if (action === "syncTransactions") {
      Logger.log("🔄 Action: syncTransactions");
      responseData = syncTransactionsAction(ss, params);
    }
    else if (action === "updateReminderStatus") {
      Logger.log("🔄 Action: updateReminderStatus");
      responseData = updateReminderStatusAction(ss, params);
    }
    else if (action === "updatePassword") {
      Logger.log("🔑 Action: updatePassword");
      responseData = updatePasswordAction(ss, params);
    }
    else if (action === "syncDiary") {
      Logger.log("📝 Action: syncDiary");
      responseData = syncDiaryAction(ss, params);
    }
    else if (action === "syncHealth") {
      Logger.log("🏥 Action: syncHealth");
      responseData = syncHealthAction(ss, params);
    }
    else {
      Logger.log("❌ Unknown action: " + action);
      responseData = { status: "error", message: "Hành động POST không hợp lệ: " + action };
    }
  } catch (err) {
    Logger.log("❌ doPost ERROR: " + err.toString());
    Logger.log("❌ Stack trace: " + err.stack);
    responseData = { status: "error", message: err.toString() };
  }
  
  Logger.log("📤 doPost response: " + JSON.stringify(responseData));
  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
} // end function doPost

// end TÁC VỤ ĐIỀU PHỐI CHÍNH

// =========================================================================
// 2. CÁC HÀM XỬ LÝ ĐỌC DỮ LIỆU (READ ACTIONS)
// =========================================================================

function getAppDataAction(ss) {
  Logger.log("📊 getAppDataAction: Bắt đầu");
  
  var data = {
    transactions: readTransactionsSheetData(ss),
    reminders: readRemindersSheetData(ss),
    family: readFamilySheetData(ss),
    diary: [],
    health: []
  };
  
  // Lấy dữ liệu diary
  try {
    var diaryResult = getDiaryDataAction(ss);
    if (diaryResult && diaryResult.status === "success") {
      data.diary = diaryResult.data || [];
      Logger.log("📊 Đã lấy " + data.diary.length + " diary entries");
    }
  } catch (err) {
    Logger.log("⚠️ Lỗi lấy diary: " + err.toString());
  }
  
  // Lấy dữ liệu health
  try {
    var healthResult = getHealthDataAction(ss);
    if (healthResult && healthResult.status === "success") {
      data.health = healthResult.data || [];
      Logger.log("📊 Đã lấy " + data.health.length + " health entries");
    }
  } catch (err) {
    Logger.log("⚠️ Lỗi lấy health: " + err.toString());
  }
  
  Logger.log("📊 getAppDataAction: Hoàn thành, transactions: " + data.transactions.length + 
             ", diary: " + data.diary.length + ", health: " + data.health.length);
  return { status: "success", data: data };
} // end function getAppDataAction

function getFamilyDataAction(ss) {
  Logger.log("👨‍👩‍👧‍👦 getFamilyDataAction: Bắt đầu");
  var familyData = readFamilySheetData(ss);
  Logger.log("👨‍👩‍👧‍👦 getFamilyDataAction: Hoàn thành, số thành viên: " + familyData.length);
  return { status: "success", data: familyData };
} // end function getFamilyDataAction

function checkPasswordAction(ss, password) {
  Logger.log("🔐 checkPasswordAction: Kiểm tra mật khẩu");
  
  var sheet = ss.getSheetByName(SHEETS_CONFIG.CONFIG_APP);
  if (!sheet) {
    Logger.log("❌ checkPasswordAction: Không tìm thấy sheet CONFIG_APP");
    return { status: "error", message: "Không tìm thấy sheet CONFIG_APP" };
  }
  
  var correctPassword = sheet.getRange("A1").getValue().toString().trim();
  Logger.log("🔐 Mật khẩu đúng: " + correctPassword);
  Logger.log("🔐 Mật khẩu nhập: " + password);
  
  if (password === correctPassword) {
    Logger.log("✅ checkPasswordAction: Mật khẩu đúng");
    return { status: "success", match: true };
  } else {
    Logger.log("❌ checkPasswordAction: Mật khẩu sai");
    return { status: "success", match: false };
  }
} // end function checkPasswordAction

// end TÁC VỤ ĐỌC DỮ LIỆU

// =========================================================================
// 3. CÁC HÀM XỬ LÝ GHI DỮ LIỆU (WRITE ACTIONS)
// =========================================================================

function saveTransactionAction(ss, params) {
  Logger.log("💾 saveTransactionAction: Bắt đầu");
  
  var sheet = ss.getSheetByName(SHEETS_CONFIG.TRANSACTIONS);
  if (!sheet) {
    Logger.log("❌ saveTransactionAction: Không tìm thấy sheet TRANSACTIONS");
    return { status: "error", message: "Không tìm thấy sheet TRANSACTIONS" };
  }
  
  var timestampStr = params.timestamp || new Date().toISOString();
  Logger.log("💾 timestampStr: " + timestampStr);
  
  var type = params.type || "";
  var subtype = params.subtype || "";
  var amount = parseFloat(params.amount) || 0;
  var note = params.note || "";

  // [HUB] Ghi kiểu Datetime thật (Date value) thay vì ép Plain Text
  var dateObj = toVietnamDateObject(timestampStr);
  Logger.log("💾 Dữ liệu ghi: " + JSON.stringify({ dateObj: dateObj ? dateObj.toString() : null, type, subtype, amount, note }));

  var newRow = sheet.getLastRow() + 1;
  sheet.getRange(newRow, 1).setNumberFormat("dd-mm-yyyy hh:mm").setValue(dateObj || timestampStr);
  sheet.getRange(newRow, 2, 1, 4).setValues([[type, subtype, amount, note]]);
  
  Logger.log("✅ saveTransactionAction: Đã ghi thành công!");
  return { status: "success", message: "Đã ghi nhận giao dịch thành công!" };
} // end function saveTransactionAction

function syncTransactionsAction(ss, params) {
  Logger.log("🔄 syncTransactionsAction: Bắt đầu");
  
  var sheet = ss.getSheetByName("TRANSACTIONS");
  if (!sheet) {
    return { status: "error", message: "Không tìm thấy sheet TRANSACTIONS" };
  }
  
  var transactions = params.data || [];
  var count = 0;
  
  var lastRow = sheet.getLastRow();
  Logger.log("📊 Số dòng hiện tại: " + lastRow);
  
  transactions.forEach(function(tx, index) {
    if (tx.timestamp && tx.type && tx.subtype && tx.amount !== undefined) {
      var row = lastRow + index + 1;
      
      // [HUB] Ghi kiểu Datetime thật thay vì ép Plain Text
      var txDateObj = toVietnamDateObject(tx.timestamp);
      sheet.getRange(row, 1).setNumberFormat("dd-mm-yyyy hh:mm").setValue(txDateObj || tx.timestamp || "");
      sheet.getRange(row, 2).setValue(tx.type || "");
      sheet.getRange(row, 3).setValue(tx.subtype || "");
      sheet.getRange(row, 4).setValue(parseFloat(tx.amount) || 0);
      sheet.getRange(row, 5).setValue(tx.note || "");
      
      count++;
      Logger.log("✅ Đã ghi dòng " + row + ": " + tx.timestamp);
    }
  });
  
  return { 
    status: "success", 
    message: "Đã đồng bộ " + count + " giao dịch!",
    count: count 
  };
} // end function syncTransactionsAction

function saveReminderAction(ss, params) {
  Logger.log("⏰ saveReminderAction: Bắt đầu");
  
  var sheet = ss.getSheetByName(SHEETS_CONFIG.REMINDERS);
  if (!sheet) {
    Logger.log("❌ saveReminderAction: Không tìm thấy sheet REMINDERS");
    return { status: "error", message: "Không tìm thấy sheet REMINDERS" };
  }
  
  var noiDungNhac = params.noiDungNhac || params.content || "";
  var tanSuat = params.tanSuat || params.frequency || "ONCE";
  var trangThai = params.trangThai || params.status || "ENABLED";

  // [HUB] Ghi kiểu Datetime thật thay vì ép Plain Text
  var ngayBatDauObj = toVietnamDateObject(params.ngayBatDau || params.startDate || new Date().toISOString());
  var ngayNhacTiepTheoObj = params.nextReminderDate ? toVietnamDateObject(params.nextReminderDate) : ngayBatDauObj;
  var lanNhacCuoiObj = params.lastTriggeredAt ? toVietnamDateObject(params.lastTriggeredAt) : null;

  Logger.log("⏰ Dữ liệu ghi: " + JSON.stringify({ noiDungNhac, tanSuat, trangThai }));

  var newRow = sheet.getLastRow() + 1;
  sheet.getRange(newRow, 1).setValue(noiDungNhac);
  sheet.getRange(newRow, 2).setValue(tanSuat);
  sheet.getRange(newRow, 3).setNumberFormat("dd-mm-yyyy hh:mm").setValue(ngayBatDauObj || "");
  sheet.getRange(newRow, 4).setValue(trangThai);
  sheet.getRange(newRow, 5).setNumberFormat("dd-mm-yyyy hh:mm").setValue(ngayNhacTiepTheoObj || "");
  if (lanNhacCuoiObj) {
    sheet.getRange(newRow, 6).setNumberFormat("dd-mm-yyyy hh:mm").setValue(lanNhacCuoiObj);
  }
  
  Logger.log("✅ saveReminderAction: Đã ghi thành công!");
  return { status: "success", message: "Đã thêm nhắc hẹn thành công!" };
} // end function saveReminderAction

function syncRemindersAction(ss, params) {
  Logger.log("🔄 syncRemindersAction: Bắt đầu");
  
  var sheet = ss.getSheetByName(SHEETS_CONFIG.REMINDERS);
  if (!sheet) {
    Logger.log("❌ syncRemindersAction: Không tìm thấy sheet REMINDERS");
    return { status: "error", message: "Không tìm thấy sheet REMINDERS" };
  }
  
  var reminders = params.data || [];
  if (!Array.isArray(reminders)) {
    Logger.log("❌ syncRemindersAction: Dữ liệu không phải là array");
    return { status: "error", message: "Dữ liệu không hợp lệ" };
  }
  
  Logger.log("🔄 syncRemindersAction: Số lượng reminders: " + reminders.length);
  
  var count = 0;
  reminders.forEach(function(rem, index) {
    Logger.log("🔄 Reminder #" + (index + 1) + ": " + JSON.stringify(rem));
    
    if (rem.content && rem.startDate) {
      var ngayBatDauObj = toVietnamDateObject(rem.startDate);
      var ngayNhacTiepTheoObj = rem.nextReminderDate ? toVietnamDateObject(rem.nextReminderDate) : ngayBatDauObj;
      var lanNhacCuoiObj = rem.lastTriggeredAt ? toVietnamDateObject(rem.lastTriggeredAt) : null;

      var newRow = sheet.getLastRow() + 1;
      sheet.getRange(newRow, 1).setValue(rem.content || "");
      sheet.getRange(newRow, 2).setValue(rem.frequency || "ONCE");
      sheet.getRange(newRow, 3).setNumberFormat("dd-mm-yyyy hh:mm").setValue(ngayBatDauObj || "");
      sheet.getRange(newRow, 4).setValue(rem.status || "ENABLED");
      sheet.getRange(newRow, 5).setNumberFormat("dd-mm-yyyy hh:mm").setValue(ngayNhacTiepTheoObj || "");
      if (lanNhacCuoiObj) {
        sheet.getRange(newRow, 6).setNumberFormat("dd-mm-yyyy hh:mm").setValue(lanNhacCuoiObj);
      }
      count++;
      Logger.log("✅ Đã ghi reminder #" + index);
    } else {
      Logger.log("⚠️ Bỏ qua reminder #" + index + " do thiếu dữ liệu");
    }
  });
  
  Logger.log("✅ syncRemindersAction: Hoàn thành, đã ghi " + count + " reminders");
  return { status: "success", message: "Đã đồng bộ " + count + " nhắc hẹn!", count: count };
} // end function syncRemindersAction

function updateReminderStatusAction(ss, params) {
  Logger.log("🔄 updateReminderStatusAction: Bắt đầu");
  
  var sheet = ss.getSheetByName(SHEETS_CONFIG.REMINDERS);
  if (!sheet) {
    Logger.log("❌ updateReminderStatusAction: Không tìm thấy sheet REMINDERS");
    return { status: "error", message: "Không tìm thấy sheet REMINDERS" };
  }
  
  var rowIndex = parseInt(params.rowIndex) || -1;
  var newStatus = params.status || "ENABLED";
  
  Logger.log("🔄 updateReminderStatusAction: rowIndex=" + rowIndex + ", newStatus=" + newStatus);
  
  if (newStatus !== "ENABLED" && newStatus !== "DISABLED") {
    Logger.log("❌ updateReminderStatusAction: Trạng thái không hợp lệ: " + newStatus);
    return { status: "error", message: "Trạng thái không hợp lệ" };
  }
  
  if (rowIndex < 2) {
    Logger.log("❌ updateReminderStatusAction: Chỉ mục dòng không hợp lệ: " + rowIndex);
    return { status: "error", message: "Chỉ mục dòng không hợp lệ" };
  }
  
  sheet.getRange(rowIndex, 4).setValue(newStatus);
  Logger.log("✅ updateReminderStatusAction: Đã cập nhật thành công!");
  return { status: "success", message: "Đã cập nhật trạng thái nhắc hẹn!" };
} // end function updateReminderStatusAction

function updatePasswordAction(ss, params) {
  Logger.log("🔑 updatePasswordAction: Bắt đầu");
  
  var sheet = ss.getSheetByName(SHEETS_CONFIG.CONFIG_APP);
  if (!sheet) {
    Logger.log("❌ updatePasswordAction: Không tìm thấy sheet CONFIG_APP");
    return { status: "error", message: "Không tìm thấy sheet CONFIG_APP" };
  }
  
  var newPassword = params.newPassword || "";
  if (newPassword.trim() === "") {
    Logger.log("❌ updatePasswordAction: Mật khẩu trống");
    return { status: "error", message: "Mật khẩu mới không được để trống!" };
  }
  
  sheet.getRange("A1").setValue(newPassword.trim());
  Logger.log("✅ updatePasswordAction: Đã đổi mật khẩu thành công!");
  return { status: "success", message: "Đổi mật khẩu ứng dụng thành công!" };
} // end function updatePasswordAction

// =========================================================================
// 3.5 CÁC HÀM XỬ LÝ DIARY & HEALTH
// =========================================================================

function syncDiaryAction(ss, params) {
  Logger.log("📝 syncDiaryAction: Bắt đầu");
  
  var sheet = ss.getSheetByName(SHEETS_CONFIG.DIARY);
  if (!sheet) {
    Logger.log("❌ syncDiaryAction: Không tìm thấy sheet DIARY");
    return { status: "error", message: "Không tìm thấy sheet DIARY" };
  }
  
  var entries = params.data || [];
  if (!Array.isArray(entries)) {
    Logger.log("❌ syncDiaryAction: Dữ liệu không phải là array");
    return { status: "error", message: "Dữ liệu không hợp lệ" };
  }
  
  Logger.log("📝 syncDiaryAction: Số lượng entries: " + entries.length);
  
  var count = 0;
  entries.forEach(function(entry, index) {
    if (entry.datetime && entry.place) {
      var newRow = sheet.getLastRow() + 1;
      
      // [HUB] Ghi kiểu Datetime thật thay vì ép Plain Text
      var diaryDateObj = toVietnamDateObject(entry.datetime);
      sheet.getRange(newRow, 1).setNumberFormat("dd-mm-yyyy hh:mm").setValue(diaryDateObj || entry.datetime || "");
      sheet.getRange(newRow, 2).setValue(entry.place || "");
      sheet.getRange(newRow, 3).setValue(entry.detail || "");
      
      count++;
      Logger.log("✅ Đã ghi diary dòng " + newRow + ": " + entry.datetime);
    } else {
      Logger.log("⚠️ Bỏ qua diary #" + index + " do thiếu dữ liệu");
    }
  });
  
  Logger.log("✅ syncDiaryAction: Hoàn thành, đã ghi " + count + " entries");
  return { status: "success", message: "Đã đồng bộ " + count + " nhật kí!", count: count };
} // end function syncDiaryAction

function getDiaryDataAction(ss) {
  Logger.log("📝 getDiaryDataAction: Bắt đầu");
  
  var diary = [];
  var sheet = ss.getSheetByName(SHEETS_CONFIG.DIARY);
  if (!sheet) {
    Logger.log("❌ getDiaryDataAction: Không tìm thấy sheet DIARY");
    return { status: "error", message: "Không tìm thấy sheet DIARY", data: [] };
  }
  
  var lastRow = sheet.getLastRow();
  Logger.log("📝 getDiaryDataAction: Số dòng cuối cùng: " + lastRow);
  
  if (lastRow < 2) {
    Logger.log("📝 getDiaryDataAction: Không có dữ liệu (chỉ có header)");
    return { status: "success", data: [] };
  }
  
  var rows = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  Logger.log("📝 getDiaryDataAction: Lấy được " + rows.length + " dòng dữ liệu");
  
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    
    var datetime = rows[i][0];
    var datetimeStr = "";
    if (datetime instanceof Date) {
      datetimeStr = formatDiaryDateTime(datetime);
    } else {
      datetimeStr = datetime.toString().trim();
    }
    
    diary.push({
      datetime: datetimeStr,
      place: rows[i][1] ? rows[i][1].toString().trim() : "",
      detail: rows[i][2] ? rows[i][2].toString().trim() : ""
    });
  }
  
  Logger.log("✅ getDiaryDataAction: Hoàn thành, " + diary.length + " entries");
  return { status: "success", data: diary };
} // end function getDiaryDataAction

function syncHealthAction(ss, params) {
  Logger.log("🏥 syncHealthAction: Bắt đầu");
  
  var sheet = ss.getSheetByName(SHEETS_CONFIG.HEALTH);
  if (!sheet) {
    Logger.log("❌ syncHealthAction: Không tìm thấy sheet HEALTH CHECK");
    return { status: "error", message: "Không tìm thấy sheet HEALTH CHECK" };
  }
  
  var entries = params.data || [];
  if (!Array.isArray(entries)) {
    Logger.log("❌ syncHealthAction: Dữ liệu không phải là array");
    return { status: "error", message: "Dữ liệu không hợp lệ" };
  }
  
  Logger.log("🏥 syncHealthAction: Số lượng entries: " + entries.length);
  
  var count = 0;
  entries.forEach(function(entry, index) {
    // Cho phép ghi nếu có ít nhất 1 trong các trường: cân nặng, huyết áp, nhịp tim
    if (entry.datetime && (entry.weight || entry.bloodPressure || entry.heartRate)) {
      var newRow = getNextEmptyRow_(sheet, "A");
      
      // Cột A: TIMESTAMP — [HUB] ghi kiểu Datetime thật (Date value) thay vì ép Plain Text
      var healthDateObj = toVietnamDateObject(entry.datetime);
      sheet.getRange(newRow, 1).setNumberFormat("dd-mm-yyyy hh:mm").setValue(healthDateObj || entry.datetime || "");
      // Cột B: CÂN NẶNG (kg)
      sheet.getRange(newRow, 2).setValue(entry.weight === "" || entry.weight === undefined || entry.weight === null ? "" : parseFloat(entry.weight));
      // Cột C: HUYẾT ÁP
      sheet.getRange(newRow, 3).setValue(entry.bloodPressure || "");
      // Cột D: NHỊP TIM
      sheet.getRange(newRow, 4).setValue(entry.heartRate || 0);
      // Cột E: DÂU (TRUE/FALSE)
      sheet.getRange(newRow, 5).setValue(entry.dau ? "TRUE" : "FALSE");
      // Cột F: NEXT DÂU PREDICTION - ĐỂ TRỐNG, TÍNH BẰNG ARRAYFORMULA
      // Không set giá trị, để ARRAYFORMULA tự tính
      
      count++;
      Logger.log("✅ Đã ghi health dòng " + newRow + ": " + entry.datetime);
    } else {
      Logger.log("⚠️ Bỏ qua health #" + index + " do thiếu dữ liệu");
    }
  });
  
  Logger.log("✅ syncHealthAction: Hoàn thành, đã ghi " + count + " entries");
  return { status: "success", message: "Đã đồng bộ " + count + " health check!", count: count };
} // end function syncHealthAction

function getHealthDataAction(ss) {
  Logger.log("🏥 getHealthDataAction: Bắt đầu");
  
  var health = [];
  var sheet = ss.getSheetByName(SHEETS_CONFIG.HEALTH);
  if (!sheet) {
    Logger.log("❌ getHealthDataAction: Không tìm thấy sheet HEALTH CHECK");
    return { status: "error", message: "Không tìm thấy sheet HEALTH CHECK", data: [] };
  }
  
  var lastRow = sheet.getLastRow();
  Logger.log("🏥 getHealthDataAction: Số dòng cuối cùng: " + lastRow);
  
  if (lastRow < 2) {
    Logger.log("🏥 getHealthDataAction: Không có dữ liệu (chỉ có header)");
    return { status: "success", data: [] };
  }
  
  // Giờ có 6 cột: A TIMESTAMP, B CÂN NẶNG, C HUYẾT ÁP, D NHỊP TIM, E DÂU, F NEXT DÂU PREDICTION
  var rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  Logger.log("🏥 getHealthDataAction: Lấy được " + rows.length + " dòng dữ liệu");
  
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    
    var datetime = rows[i][0];
    var datetimeStr = "";
    if (datetime instanceof Date) {
      datetimeStr = formatHealthDateTime(datetime);
    } else {
      datetimeStr = datetime.toString().trim();
    }
    
    var dauValue = false;
    var dauCell = rows[i][4];
    if (dauCell === true || dauCell === "TRUE" || dauCell === "true") {
      dauValue = true;
    }
    
    health.push({
      datetime: datetimeStr,
      weight: rows[i][1] !== "" && rows[i][1] !== null ? parseFloat(rows[i][1]) : null,
      bloodPressure: rows[i][2] ? rows[i][2].toString().trim() : "",
      heartRate: parseInt(rows[i][3]) || 0,
      dau: dauValue,
      nextDauPrediction: rows[i][5] ? rows[i][5].toString().trim() : ""
    });
  }
  
  Logger.log("✅ getHealthDataAction: Hoàn thành, " + health.length + " entries");
  return { status: "success", data: health };
} // end function getHealthDataAction



// end CÁC HÀM XỬ LÝ DIARY & HEALTH

// =========================================================================
// 4. CÁC HÀM TRÍCH XUẤT DỮ LIỆU THẤP CẤP (LOW LEVEL READERS)
// =========================================================================

function readTransactionsSheetData(ss) {
  Logger.log("📖 readTransactionsSheetData: Bắt đầu");
  
  var list = [];
  var sheet = ss.getSheetByName(SHEETS_CONFIG.TRANSACTIONS);
  if (!sheet) {
    Logger.log("❌ readTransactionsSheetData: Không tìm thấy sheet TRANSACTIONS");
    return list;
  }
  
  var rows = sheet.getDataRange().getValues();
  Logger.log("📖 readTransactionsSheetData: Số dòng: " + rows.length);
  
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    
    var timestamp = rows[i][0];
    var timestampStr = "";
    if (timestamp instanceof Date) {
      timestampStr = formatVietnamDateTime(timestamp);
    } else {
      timestampStr = timestamp.toString();
    }
    
    list.push({
      timestamp: timestampStr,
      type: rows[i][1] || "",
      subtype: rows[i][2] || "",
      amount: parseFloat(rows[i][3]) || 0,
      note: rows[i][4] || ""
    });
  }
  
  Logger.log("✅ readTransactionsSheetData: Hoàn thành, " + list.length + " transactions");
  return list;
} // end function readTransactionsSheetData

function readRemindersSheetData(ss) {
  Logger.log("📖 readRemindersSheetData: Bắt đầu");
  
  var reminders = [];
  var sheet = ss.getSheetByName(SHEETS_CONFIG.REMINDERS);
  if (!sheet) {
    Logger.log("❌ readRemindersSheetData: Không tìm thấy sheet REMINDERS");
    return reminders;
  }
  
  var rows = sheet.getDataRange().getValues();
  Logger.log("📖 readRemindersSheetData: Số dòng: " + rows.length);
  
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    
    var content = rows[i][0] || "";
    var frequency = rows[i][1] || "ONCE";
    
    var startDate = rows[i][2];
    var startDateStr = "";
    if (startDate instanceof Date) {
      startDateStr = formatVietnamDateTime(startDate);
    } else {
      startDateStr = startDate.toString();
    }
    
    var status = (rows[i][3] || "ENABLED").toString().trim().toUpperCase();
    
    var nextReminderDate = rows[i][4];
    var nextReminderDateStr = "";
    if (nextReminderDate instanceof Date) {
      nextReminderDateStr = formatVietnamDateTime(nextReminderDate);
    } else {
      nextReminderDateStr = nextReminderDate ? nextReminderDate.toString() : startDateStr;
    }
    
    var lastTriggeredAt = rows[i][5];
    var lastTriggeredAtStr = "";
    if (lastTriggeredAt instanceof Date) {
      lastTriggeredAtStr = formatVietnamDateTime(lastTriggeredAt);
    } else {
      lastTriggeredAtStr = lastTriggeredAt ? lastTriggeredAt.toString() : "";
    }
    
    reminders.push({
      content: content,
      frequency: frequency,
      startDate: startDateStr,
      status: status,
      nextReminderDate: nextReminderDateStr,
      lastTriggeredAt: lastTriggeredAtStr,
      rowIndex: i + 1
    });
  }
  
  Logger.log("✅ readRemindersSheetData: Hoàn thành, " + reminders.length + " reminders");
  return reminders;
} // end function readRemindersSheetData

function getNextEmptyRow_(sheet, column) {
  Logger.log("🔥 getNextEmptyRow_ ĐANG CHẠY - bản mới nhất");   // ← thêm dòng này
  column = column || "A";
  var colValues = sheet.getRange(column + "1:" + column + sheet.getMaxRows()).getValues();
  for (var i = colValues.length - 1; i >= 0; i--) {
    if (colValues[i][0] !== "" && colValues[i][0] !== null) {
      return i + 2;
    }
  }
  return 2;
} // end function getNextEmptyRow_

function readFamilySheetData(ss) {
  Logger.log("📖 readFamilySheetData: Bắt đầu");
  
  var family = [];
  var sheet = ss.getSheetByName(SHEETS_CONFIG.FAMILY);
  if (!sheet) {
    Logger.log("❌ readFamilySheetData: Không tìm thấy sheet FAMILY");
    return family;
  }
  
  var rows = sheet.getRange("A4:T").getValues();
  Logger.log("📖 readFamilySheetData: Số dòng: " + rows.length);
  
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i][0] || rows[i][0].toString().trim() === "" || rows[i][0].toString().trim().toUpperCase() === "NICKNAME") continue;
    
    var formatDate = function(dateVal) {
      if (!dateVal) return "-";
      if (dateVal instanceof Date) {
        var day = String(dateVal.getDate()).padStart(2, '0');
        var month = String(dateVal.getMonth() + 1).padStart(2, '0');
        var year = dateVal.getFullYear();
        return day + "/" + month + "/" + year;
      }
      return dateVal.toString();
    };
    
    family.push({
      nickname: rows[i][0] || "-",
      fullname: rows[i][1] || "-",
      dob: formatDate(rows[i][2]),
      noisinh: rows[i][3] || "-",
      diachi: rows[i][4] || "-",
      dienthoai: rows[i][5] || "-",
      cccd: {
        so: rows[i][6] || "-",
        ngaycap: rows[i][7] || "-",
        ngayhethan: rows[i][8] || "-",
        noicap: rows[i][9] || "-"
      },
      hochieu: {
        so: rows[i][10] || "-",
        ngaycap: rows[i][11] || "-",
        ngayhethan: rows[i][12] || "-",
        noicap: rows[i][13] || "-"
      },
      bhyt: rows[i][14] || "-",
      bhxh: rows[i][15] || "-",
      masothue: rows[i][16] || "-",
      lltp: {
        so: rows[i][17] || "-",
        ngaycap: formatDate(rows[i][18]),
        noicap: rows[i][19] || "-"
      }
    });
  }
  
  Logger.log("✅ readFamilySheetData: Hoàn thành, " + family.length + " thành viên");
  return family;
} // end function readFamilySheetData

// end TÁC VỤ TRÍCH XUẤT DỮ LIỆU THẤP CẤP

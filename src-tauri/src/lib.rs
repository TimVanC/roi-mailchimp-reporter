use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;
use reqwest;
use std::io::Write;
use std::fs::File;

#[derive(Debug, Serialize, Deserialize)]
struct Settings {
    mailchimp_api_key: String,
    mailchimp_audience_id: String,
    advertisers: Vec<String>,
    download_directory: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ReportRequest {
    newsletter_type: String,
    advertiser: String,
    tracking_urls: Vec<String>,
    date_range: DateRange,
    metrics: Metrics,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct DateRange {
    start_date: String,
    end_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Metrics {
    unique_opens: bool,
    total_opens: bool,
    total_recipients: bool,
    total_clicks: bool,
    ctr: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct ReportResponse {
    success: bool,
    message: String,
    data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SavedReport {
    id: String,
    name: String,
    advertiser: String,
    report_type: String,
    date_range: DateRange,
    created: String,
    data: serde_json::Value,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn load_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    let app_dir = app.path().app_config_dir()
        .map_err(|e| format!("Could not get app directory: {}", e))?;
    let settings_path = app_dir.join("settings.json");
    
    println!("Loading settings from: {:?}", settings_path);

    if !settings_path.exists() {
        println!("Settings file does not exist, returning default settings");
        
        // Get the default downloads directory
        let default_download_dir = match dirs::download_dir() {
            Some(path) => path.to_string_lossy().to_string(),
            None => {
                // Fallback to home directory + Downloads if download_dir can't be found
                let home_dir = dirs::home_dir()
                    .ok_or_else(|| "Could not determine home directory".to_string())?;
                home_dir.join("Downloads").to_string_lossy().to_string()
            }
        };
        
        return Ok(Settings {
            mailchimp_api_key: String::new(),
            mailchimp_audience_id: String::new(),
            advertisers: Vec::new(),
            download_directory: default_download_dir,
        });
    }

    let settings_str = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;
    
    println!("Settings content: {}", settings_str);
    
    // Try to parse settings, and handle potential missing fields
    let mut settings: Settings = match serde_json::from_str(&settings_str) {
        Ok(settings) => settings,
        Err(e) => {
            // If there's a parsing error, try to load as a dynamic JSON value
            let json_value: serde_json::Value = serde_json::from_str(&settings_str)
                .map_err(|e| format!("Failed to parse settings JSON: {}", e))?;
            
            // Get default download directory 
            let default_download_dir = match dirs::download_dir() {
                Some(path) => path.to_string_lossy().to_string(),
                None => {
                    let home_dir = dirs::home_dir()
                        .ok_or_else(|| "Could not determine home directory".to_string())?;
                    home_dir.join("Downloads").to_string_lossy().to_string()
                }
            };
            
            // Create settings struct with values from JSON or defaults
            Settings {
                mailchimp_api_key: json_value.get("mailchimp_api_key")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                mailchimp_audience_id: json_value.get("mailchimp_audience_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                advertisers: json_value.get("advertisers")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|item| item.as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_else(Vec::new),
                download_directory: default_download_dir,
            }
        }
    };
    
    // Ensure download_directory is set if it's empty
    if settings.download_directory.is_empty() {
        let default_download_dir = match dirs::download_dir() {
            Some(path) => path.to_string_lossy().to_string(),
            None => {
                let home_dir = dirs::home_dir()
                    .ok_or_else(|| "Could not determine home directory".to_string())?;
                home_dir.join("Downloads").to_string_lossy().to_string()
            }
        };
        settings.download_directory = default_download_dir;
    }
    
    println!("Parsed settings: {:?}", settings);
    
    Ok(settings)
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    // Get the app config directory
    let app_dir = app.path().app_config_dir()
        .map_err(|e| format!("Could not get app directory: {}", e))?;
    
    println!("Saving settings to directory: {:?}", app_dir);
    
    // Create the config directory and all parent directories if they don't exist
    if !app_dir.exists() {
        println!("Creating config directory: {:?}", app_dir);
        fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Failed to create config directory: {} - Error: {}", app_dir.display(), e))?;
    }
    
    // Verify the directory exists and is writable
    if !app_dir.exists() {
        return Err(format!("Config directory does not exist after creation attempt: {}", app_dir.display()));
    }
    
    // Set up the settings file path
    let settings_path = app_dir.join("settings.json");
    println!("Settings file path: {:?}", settings_path);

    // Serialize the settings to JSON
    let settings_str = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    println!("Settings to save: {}", settings_str);

    // Write the settings to file
    match fs::write(&settings_path, &settings_str) {
        Ok(_) => {
            println!("Settings saved successfully to {}", settings_path.display());
            
            // Verify the file was written correctly by reading it back
            match fs::read_to_string(&settings_path) {
                Ok(content) => {
                    if content == settings_str {
                        println!("File content verified");
                    } else {
                        println!("WARNING: File content verification failed - content mismatch");
                    }
                },
                Err(e) => println!("WARNING: Could not verify file content: {}", e),
            }
            
            Ok(())
        },
        Err(e) => Err(format!("Failed to write settings to {}: {}", settings_path.display(), e))
    }
}

#[tauri::command]
fn load_reports(app: tauri::AppHandle) -> Result<Vec<SavedReport>, String> {
    let app_dir = app.path().app_config_dir()
        .map_err(|e| format!("Could not get app directory: {}", e))?;
    let reports_path = app_dir.join("reports.json");

    if !reports_path.exists() {
        return Ok(Vec::new());
    }

    let reports_str = fs::read_to_string(&reports_path)
        .map_err(|e| format!("Failed to read reports: {}", e))?;
    
    serde_json::from_str(&reports_str)
        .map_err(|e| format!("Failed to parse reports: {}", e))
}

#[tauri::command]
fn save_report(app: tauri::AppHandle, report: SavedReport) -> Result<(), String> {
    let app_dir = app.path().app_config_dir()
        .map_err(|e| format!("Could not get app directory: {}", e))?;
    
    // Create the config directory if it doesn't exist
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;
    
    let reports_path = app_dir.join("reports.json");
    let mut reports = load_reports(app.clone())?;
    
    // Add new report
    reports.push(report);

    let reports_str = serde_json::to_string_pretty(&reports)
        .map_err(|e| format!("Failed to serialize reports: {}", e))?;

    fs::write(&reports_path, reports_str)
        .map_err(|e| format!("Failed to write reports: {}", e))
}

#[tauri::command]
async fn generate_report(app: tauri::AppHandle, request: ReportRequest) -> Result<ReportResponse, String> {
    // Load settings
    let settings = load_settings(app.clone())?;
    
    if settings.mailchimp_api_key.is_empty() || settings.mailchimp_audience_id.is_empty() {
        return Ok(ReportResponse {
            success: false,
            message: "Mailchimp API settings not configured".to_string(),
            data: None,
        });
    }

    // Create Mailchimp API client
    let client = reqwest::Client::new();
    let dc = settings.mailchimp_api_key.split('-').last().unwrap_or("us1");
    let base_url = format!("https://{}.api.mailchimp.com/3.0", dc);

    // Format dates for the API call - convert to ISO format
    let start_date_iso = format!("{}T00:00:00Z", &request.date_range.start_date);
    let end_date = chrono::NaiveDate::parse_from_str(&request.date_range.end_date, "%Y-%m-%d")
        .map_err(|e| format!("Failed to parse end date: {}", e))?;
    // Add one day to end date and subtract one second (as in Python script)
    let end_date_iso = format!("{}T23:59:59Z", end_date);
    
    // Fetch campaigns for the date range
    let campaigns_url = format!(
        "{}/campaigns?since_send_time={}&before_send_time={}&count=1000", 
        base_url, start_date_iso, end_date_iso
    );
    
    let campaigns_response = client
        .get(&campaigns_url)
        .header("Authorization", format!("Bearer {}", settings.mailchimp_api_key))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch campaigns: {}", e))?;

    if !campaigns_response.status().is_success() {
        let error_text = campaigns_response.text().await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Ok(ReportResponse {
            success: false,
            message: format!("Mailchimp API error: {}", error_text),
            data: None,
        });
    }

    let campaigns_data = campaigns_response.json::<serde_json::Value>().await
        .map_err(|e| format!("Failed to parse campaigns response: {}", e))?;
    
    // Get the actual campaigns array
    let campaigns = match campaigns_data.get("campaigns") {
        Some(campaigns_array) if campaigns_array.is_array() => campaigns_array.as_array().unwrap(),
        _ => {
            return Ok(ReportResponse {
                success: false,
                message: "No campaigns found in response".to_string(),
                data: None,
            });
        }
    };
    
    // Filter campaigns by newsletter type
    let mut filtered_campaigns = Vec::new();
    let newsletter_type_lower = request.newsletter_type.to_lowercase();
    
    for campaign in campaigns {
        if let Some(settings) = campaign.get("settings") {
            if let Some(title) = settings.get("title").and_then(|t| t.as_str()) {
                let title_lower = title.to_lowercase();
                
                // Apply the same filtering logic as in Python
                let matches = if newsletter_type_lower == "hc" {
                    title_lower.contains("hc") || title_lower.contains("health care")
                } else {
                    title_lower.contains(&newsletter_type_lower)
                };
                
                if matches {
                    filtered_campaigns.push(campaign.clone());
                }
            }
        }
    }
    
    // Process each filtered campaign to analyze clicks for the specific ad URLs
    let mut report_data = Vec::new();
    
    for campaign in &filtered_campaigns {
        // Extract campaign ID and metrics
        let campaign_id = match campaign.get("id").and_then(|id| id.as_str()) {
            Some(id) => id,
            None => continue, // Skip if no ID
        };
        
        // Get campaign send time
        let send_time = match campaign.get("send_time").and_then(|st| st.as_str()) {
            Some(time) => time,
            None => continue, // Skip if no send time
        };
        
        // Format date as in Python script
        let formatted_date = match chrono::DateTime::parse_from_rfc3339(send_time) {
            Ok(dt) => dt.format("%Y-%m-%d").to_string(),
            Err(_) => continue, // Skip if date can't be parsed
        };
        
        // Extract basic metrics
        let report_summary = campaign.get("report_summary").unwrap_or(&serde_json::Value::Null);
        let unique_opens = report_summary.get("unique_opens").and_then(|v| v.as_u64()).unwrap_or(0);
        let total_opens = report_summary.get("opens").and_then(|v| v.as_u64()).unwrap_or(0);
        let total_recipients = campaign.get("emails_sent").and_then(|v| v.as_u64()).unwrap_or(0);
        
        // Now fetch click details for this campaign
        let mut ad_clicks: u64 = 0;
        
        // Set up click details API endpoint
        let click_url = format!("{}/reports/{}/click-details?count=1000", base_url, campaign_id);
        
        // Get click details
        let click_response = client
            .get(&click_url)
            .header("Authorization", format!("Bearer {}", settings.mailchimp_api_key))
            .send()
            .await;
        
        if let Ok(response) = click_response {
            if response.status().is_success() {
                if let Ok(click_data) = response.json::<serde_json::Value>().await {
                    if let Some(urls_clicked) = click_data.get("urls_clicked").and_then(|u| u.as_array()) {
                        for url_item in urls_clicked {
                            if let Some(url) = url_item.get("url").and_then(|u| u.as_str()) {
                                // Check if the URL contains any of our tracking URLs
                                for tracking_url in &request.tracking_urls {
                                    if !tracking_url.is_empty() && url.contains(tracking_url) {
                                        ad_clicks += url_item.get("total_clicks").and_then(|c| c.as_u64()).unwrap_or(0);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Calculate CTR
        let ctr = if unique_opens > 0 {
            (ad_clicks as f64 / unique_opens as f64) * 100.0
        } else {
            0.0
        };
        
        // Only include campaigns that had ad clicks (matching Python logic)
        if ad_clicks > 0 {
            let campaign_report = serde_json::json!({
                "send_date": formatted_date,
                "unique_opens": unique_opens,
                "total_opens": total_opens, 
                "total_recipients": total_recipients,
                "total_clicks": ad_clicks,
                "ctr": ctr
            });
            
            report_data.push(campaign_report);
        }
    }
    
    // Sort report data by date
    report_data.sort_by(|a, b| {
        let date_a = a.get("send_date").and_then(|d| d.as_str()).unwrap_or("");
        let date_b = b.get("send_date").and_then(|d| d.as_str()).unwrap_or("");
        date_a.cmp(date_b)
    });
    
    // Create the final report data
    let final_report = serde_json::json!({
        "campaigns": filtered_campaigns,
        "report_data": report_data
    });
    
    // Save the report
    let report = SavedReport {
        id: format!("report-{}", chrono::Utc::now().timestamp_millis()),
        name: format!("{}-{}-{}", request.advertiser, request.newsletter_type, chrono::Utc::now().format("%Y-%m-%d")),
        advertiser: request.advertiser,
        report_type: request.newsletter_type,
        date_range: request.date_range,
        created: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        data: final_report.clone(),
    };

    save_report(app, report)?;

    Ok(ReportResponse {
        success: true,
        message: "Report generated successfully".to_string(),
        data: Some(final_report),
    })
}

#[tauri::command]
fn open_report_in_excel(_window: tauri::Window, reportData: serde_json::Value) -> Result<String, String> {
    // Create a timestamp for the file name
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    
    // Get the system temp directory
    let temp_dir = std::env::temp_dir();
    
    // Create a file with .csv extension
    let file_name = format!("campaign_report_{}.csv", timestamp);
    let file_path = temp_dir.join(&file_name);
    
    // Create CSV content with headers
    let mut csv = String::new();
    csv.push_str("Date,Unique Opens,Total Opens,Total Recipients,Total Clicks,Ctr\n");
    
    // The report data is now in the "report_data" field
    if let Some(report_entries) = reportData.get("report_data").and_then(|d| d.as_array()) {
        // Report entries are already sorted by date in the backend
        for entry in report_entries {
            let date = entry.get("send_date").and_then(|d| d.as_str()).unwrap_or("N/A");
            let unique_opens = entry.get("unique_opens").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_opens = entry.get("total_opens").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_recipients = entry.get("total_recipients").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_clicks = entry.get("total_clicks").and_then(|v| v.as_u64()).unwrap_or(0);
            let ctr = entry.get("ctr").and_then(|v| v.as_f64()).unwrap_or(0.0);
            
            // Format the CSV line
            csv.push_str(&format!(
                "{},{},{},{},{},{:.6}\n",
                date,
                unique_opens,
                total_opens,
                total_recipients,
                total_clicks,
                ctr
            ));
        }
    } else {
        // If no report data found, create an empty report with headers only
        csv.push_str("No campaign data found\n");
    }
    
    // Write the CSV content to the file
    std::fs::write(&file_path, csv.as_bytes())
        .map_err(|e| format!("Failed to write CSV: {}", e))?;
    
    // Return the file path as a string
    file_path.to_str()
        .ok_or_else(|| "Failed to get file path".to_string())
        .map(|s| s.to_string())
}

#[tauri::command]
fn write_report_file(path: String, report: serde_json::Value) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&report)
        .map_err(|e| format!("Failed to serialize report: {}", e))?;
    let mut file = File::create(&path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

#[tauri::command]
fn delete_report(app: tauri::AppHandle, report_id: String) -> Result<(), String> {
    let app_dir = app.path().app_config_dir()
        .map_err(|e| format!("Could not get app directory: {}", e))?;
    let reports_path = app_dir.join("reports.json");

    if !reports_path.exists() {
        return Ok(());
    }

    let reports_str = fs::read_to_string(&reports_path)
        .map_err(|e| format!("Failed to read reports: {}", e))?;
    
    let mut reports: Vec<SavedReport> = serde_json::from_str(&reports_str)
        .map_err(|e| format!("Failed to parse reports: {}", e))?;

    // Remove the report with matching ID
    reports.retain(|r| r.id != report_id);

    let reports_str = serde_json::to_string_pretty(&reports)
        .map_err(|e| format!("Failed to serialize reports: {}", e))?;

    fs::write(&reports_path, reports_str)
        .map_err(|e| format!("Failed to write reports: {}", e))
}

#[tauri::command]
fn opener_open(_app: tauri::AppHandle, path: String) -> Result<(), String> {
    // Use a standard method to open the file
    let path_obj = std::path::Path::new(&path);
    opener::open(path_obj)
        .map_err(|e| format!("Failed to open file: {}", e))
}

#[tauri::command]
fn download_report(app: tauri::AppHandle, report: serde_json::Value) -> Result<String, String> {
    // Create a timestamp for the file name
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    
    // Load settings to get the custom download directory
    let settings = load_settings(app.clone())?;
    
    // Use the download directory from settings
    let download_dir = std::path::Path::new(&settings.download_directory);
    
    // Create the directory if it doesn't exist
    if !download_dir.exists() {
        std::fs::create_dir_all(download_dir)
            .map_err(|e| format!("Failed to create download directory: {}", e))?;
    }
    
    // Create a file name with the report name if available
    let report_name = report.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("report");
    
    let file_name = format!("{}_{}.json", report_name, timestamp);
    let file_path = download_dir.join(file_name);
    
    // Serialize report to JSON
    let report_json = serde_json::to_string_pretty(&report)
        .map_err(|e| format!("Failed to serialize report: {}", e))?;

    // Write to file
    std::fs::write(&file_path, report_json.as_bytes())
        .map_err(|e| format!("Failed to write file: {}", e))?;

    // Return the file path for displaying to the user
    let path_str = file_path.to_string_lossy().to_string();
    Ok(path_str)
}

#[tauri::command]
fn download_csv(app: tauri::AppHandle, reportData: serde_json::Value) -> Result<String, String> {
    // Create a timestamp for the file name
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    
    // Load settings to get the custom download directory
    let settings = load_settings(app.clone())?;
    
    // Use the download directory from settings
    let download_dir = std::path::Path::new(&settings.download_directory);
    
    // Create the directory if it doesn't exist
    if !download_dir.exists() {
        std::fs::create_dir_all(download_dir)
            .map_err(|e| format!("Failed to create download directory: {}", e))?;
    }
    
    // Create a file name
    let file_name = format!("campaign_report_{}.csv", timestamp);
    let file_path = download_dir.join(&file_name);
    
    // Create CSV content with headers
    let mut csv = String::new();
    csv.push_str("Date,Unique Opens,Total Opens,Total Recipients,Total Clicks,Ctr\n");
    
    if let Some(report_entries) = reportData.get("report_data").and_then(|d| d.as_array()) {
        for entry in report_entries {
            let date = entry.get("send_date").and_then(|d| d.as_str()).unwrap_or("N/A");
            let unique_opens = entry.get("unique_opens").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_opens = entry.get("total_opens").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_recipients = entry.get("total_recipients").and_then(|v| v.as_u64()).unwrap_or(0);
            let total_clicks = entry.get("total_clicks").and_then(|v| v.as_u64()).unwrap_or(0);
            let ctr = entry.get("ctr").and_then(|v| v.as_f64()).unwrap_or(0.0);
            
            // Format the CSV line
            csv.push_str(&format!(
                "{},{},{},{},{},{:.6}\n",
                date,
                unique_opens,
                total_opens,
                total_recipients,
                total_clicks,
                ctr
            ));
        }
    } else {
        csv.push_str("No campaign data found\n");
    }
    
    // Write the CSV content to the file
    std::fs::write(&file_path, csv.as_bytes())
        .map_err(|e| format!("Failed to write CSV: {}", e))?;
    
    // Return the file path as a string
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_settings_path(app: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app.path().app_config_dir()
        .map_err(|e| format!("Could not get app directory: {}", e))?;
    let settings_path = app_dir.join("settings.json");
    
    Ok(settings_path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            load_settings,
            save_settings,
            generate_report,
            load_reports,
            save_report,
            open_report_in_excel,
            write_report_file,
            delete_report,
            opener_open,
            download_report,
            download_csv,
            get_settings_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

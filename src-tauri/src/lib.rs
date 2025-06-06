use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;
use reqwest;
use std::io::Write;
use std::fs::File;
use tauri::Emitter;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use url::Url;

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

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Metrics {
    unique_opens: bool,
    total_opens: bool,
    total_recipients: bool,
    total_clicks: bool,
    ctr: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ProgressUpdate {
    stage: String,
    progress: u8,
    message: String,
    time_remaining: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ReportResponse {
    success: bool,
    message: String,
    data: Option<serde_json::Value>,
    progress_updates: Vec<ProgressUpdate>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct SavedReport {
    id: String,
    name: String,
    advertiser: String,
    report_type: String,
    date_range: DateRange,
    created: String,
    data: serde_json::Value,
    metrics: Metrics,
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
    println!("App config directory: {:?}", app_dir);
    println!("Settings file exists: {}", settings_path.exists());

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
        
        // Default advertisers list
        let default_advertisers = vec![
            "HBCB (Horizon Blue Cross Blue Shield)".to_string(),
            "NJUA".to_string(),
            "NJ American Water".to_string(),
            "EisnerAmper".to_string(),
            "Gibbons Law".to_string(),
            "Valley Health Systems".to_string(),
            "Withum".to_string(),
            "Grassi".to_string(),
            "ACG".to_string(),
            "Local 825".to_string(),
            "Mizuho".to_string(),
            "Caucus".to_string(),
            "MSU".to_string(),
            "Jersey City Summit".to_string(),
            "NJ Bankers".to_string(),
        ];
        
        let settings = Settings {
            mailchimp_api_key: String::new(),
            mailchimp_audience_id: "6732b2b110".to_string(),
            advertisers: default_advertisers,
            download_directory: default_download_dir,
        };
        
        println!("Returning default settings: {:?}", settings);
        return Ok(settings);
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
                mailchimp_audience_id: "6732b2b110".to_string(),
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
    
    println!("Loading reports from: {:?}", reports_path);
    
    // First try to parse as raw JSON to handle missing fields
    let reports_json: Vec<serde_json::Value> = serde_json::from_str(&reports_str)
        .map_err(|e| format!("Failed to parse reports JSON: {}", e))?;
    
    // Convert each report with proper field handling
    let mut converted_reports = Vec::new();
    for report_json in reports_json {
        let default_metrics = Metrics {
            unique_opens: true,
            total_opens: true,
            total_recipients: true,
            total_clicks: true,
            ctr: true,
        };

        let report = SavedReport {
            id: report_json.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            name: report_json.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            advertiser: report_json.get("advertiser").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            report_type: report_json.get("report_type").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            date_range: match report_json.get("date_range") {
                Some(dr) => serde_json::from_value(dr.clone())
                    .unwrap_or(DateRange {
                        start_date: "".to_string(),
                        end_date: "".to_string(),
                    }),
                None => DateRange {
                    start_date: "".to_string(),
                    end_date: "".to_string(),
                },
            },
            created: report_json.get("created").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            data: report_json.get("data").cloned().unwrap_or(serde_json::json!({})),
            metrics: report_json.get("metrics")
                .and_then(|m| serde_json::from_value(m.clone()).ok())
                .unwrap_or(default_metrics),
        };
        
        converted_reports.push(report);
    }
    
    println!("Successfully loaded and converted {} reports", converted_reports.len());
    Ok(converted_reports)
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

// Add these validation functions before the generate_report function
fn validate_tracking_urls(urls: &[String]) -> Result<(), String> {
    if urls.is_empty() {
        return Err("No tracking URLs provided".to_string());
    }

    for url in urls {
        if url.is_empty() {
            continue; // Skip empty URLs as they're handled separately
        }

        // Check if it's a valid URL or URL path component
        if !url.starts_with("http://") && !url.starts_with("https://") {
            // If not a full URL, check if it's at least a valid URL path component
            if url.contains(char::is_whitespace) || url.contains('<') || url.contains('>') {
                return Err(format!("Invalid tracking URL or path component: {}", url));
            }
        } else {
            // If it's meant to be a full URL, validate it properly
            if let Err(_) = Url::parse(url) {
                return Err(format!("Invalid tracking URL format: {}", url));
            }
        }
    }
    Ok(())
}

fn validate_campaign_data(campaigns: &[serde_json::Value], newsletter_type: &str) -> Result<(), String> {
    if campaigns.is_empty() {
        return Err("No campaigns found for the specified date range".to_string());
    }

    let newsletter_type_lower = newsletter_type.to_lowercase();
    let mut matching_campaigns = 0;

    for campaign in campaigns {
        if let Some(settings) = campaign.get("settings") {
            if let Some(title) = settings.get("title").and_then(|t| t.as_str()) {
                let title_lower = title.to_lowercase();
                
                let matches = if newsletter_type_lower == "hc" {
                    title_lower.contains("hc") || title_lower.contains("health care")
                } else {
                    title_lower.contains(&newsletter_type_lower)
                };
                
                if matches {
                    matching_campaigns += 1;
                }
            }
        }
    }

    if matching_campaigns == 0 {
        return Err(format!(
            "No campaigns found matching the newsletter type '{}'. Please check if the newsletter type is correct.",
            newsletter_type
        ));
    }

    Ok(())
}

#[tauri::command]
async fn generate_report(app: tauri::AppHandle, request: ReportRequest) -> Result<ReportResponse, String> {
    // Validate tracking URLs first
    validate_tracking_urls(&request.tracking_urls)?;

    // Init progress tracking with start time
    let start_time = std::time::Instant::now();
    let mut progress_updates = Vec::new();
    
    // First progress update
    let initial_update = ProgressUpdate {
        stage: "Initializing".to_string(),
        progress: 0,
        message: "Starting report generation...".to_string(),
        time_remaining: None,
    };
    
    // Store in vector and emit to frontend
    progress_updates.push(initial_update.clone());
    
    // Emit the progress update to the frontend
    if let Err(e) = app.emit("report-progress", initial_update) {
        println!("Failed to emit progress update: {}", e);
    }

    // Load settings
    let settings = load_settings(app.clone())?;
    
    if settings.mailchimp_api_key.is_empty() || settings.mailchimp_audience_id.is_empty() {
        return Ok(ReportResponse {
            success: false,
            message: "Mailchimp API settings not configured".to_string(),
            data: None,
            progress_updates,
        });
    }

    // 10% progress
    let connecting_update = ProgressUpdate {
        stage: "FetchingCampaigns".to_string(),
        progress: 10,
        message: "Connecting to Mailchimp API...".to_string(),
        time_remaining: None,
    };
    
    // Store and emit update
    progress_updates.push(connecting_update.clone());
    if let Err(e) = app.emit("report-progress", connecting_update) {
        println!("Failed to emit progress update: {}", e);
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
    
    // 20% progress
    let fetching_update = ProgressUpdate {
        stage: "FetchingCampaigns".to_string(),
        progress: 20,
        message: "Fetching campaign data from Mailchimp...".to_string(),
        time_remaining: None,
    };
    
    // Store and emit update
    progress_updates.push(fetching_update.clone());
    if let Err(e) = app.emit("report-progress", fetching_update) {
        println!("Failed to emit progress update: {}", e);
    }
    
    let campaigns_response = client
        .get(&campaigns_url)
        .header("Authorization", format!("Basic {}", STANDARD.encode(format!("anystring:{}", settings.mailchimp_api_key))))
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
            progress_updates,
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
                progress_updates,
            });
        }
    };
    
    // After fetching campaigns, validate the campaign data
    validate_campaign_data(campaigns, &request.newsletter_type)?;

    // 30% progress
    let filtering_update = ProgressUpdate {
        stage: "FilteringCampaigns".to_string(),
        progress: 30,
        message: format!("Found {} campaigns. Filtering by newsletter type...", campaigns.len()),
        time_remaining: None,
    };
    
    // Store and emit update
    progress_updates.push(filtering_update.clone());
    if let Err(e) = app.emit("report-progress", filtering_update) {
        println!("Failed to emit progress update: {}", e);
    }
    
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
    
    // 40% progress
    let initial_processing_update = ProgressUpdate {
        stage: "ProcessingCampaigns".to_string(),
        progress: 40,
        message: format!("Processing {} campaigns...", filtered_campaigns.len()),
        time_remaining: Some((filtered_campaigns.len() as f64 * 0.5) as u64), // Initial estimate: 0.5 seconds per campaign
    };
    
    progress_updates.push(initial_processing_update.clone());
    if let Err(e) = app.emit("report-progress", initial_processing_update) {
        println!("Failed to emit progress update: {}", e);
    }
    
    // Process each filtered campaign to analyze clicks for the specific ad URLs
    let mut report_data = Vec::new();
    
    // Calculate progress increment per campaign
    let campaign_progress_increment = if filtered_campaigns.is_empty() {
        0.0
    } else {
        40.0 / (filtered_campaigns.len() as f64)
    };
    
    for (index, campaign) in filtered_campaigns.iter().enumerate() {
        // Calculate current progress (40-80% is for campaign processing)
        let current_progress = 40 + ((index as f64) * campaign_progress_increment) as u8;
        
        // Calculate time remaining based on actual processing rate
        let elapsed = start_time.elapsed().as_secs_f64();
        let time_remaining = if index > 0 {
            // Calculate average time per campaign
            let avg_time_per_campaign = elapsed / (index as f64);
            // Calculate remaining campaigns
            let remaining_campaigns = filtered_campaigns.len() - index;
            // Estimate remaining time
            let remaining_secs = avg_time_per_campaign * (remaining_campaigns as f64);
            Some(remaining_secs.ceil() as u64)
        } else {
            // Initial estimate
            Some((filtered_campaigns.len() as f64 * 0.5) as u64)
        };
        
        // Add progress update for individual campaign
        let campaign_update = ProgressUpdate {
            stage: "ProcessingCampaigns".to_string(),
            progress: current_progress,
            message: format!("Processing campaign {} of {}: {}", 
                index + 1, 
                filtered_campaigns.len(),
                campaign.get("settings")
                    .and_then(|s| s.get("title"))
                    .and_then(|t| t.as_str())
                    .unwrap_or("Untitled")
            ),
            time_remaining,
        };
        
        // Store and emit update
        progress_updates.push(campaign_update.clone());
        if let Err(e) = app.emit("report-progress", campaign_update) {
            println!("Failed to emit progress update: {}", e);
        }
        
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
            .header("Authorization", format!("Basic {}", STANDARD.encode(format!("anystring:{}", settings.mailchimp_api_key))))
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
    
    // Modify the final success check to ensure we have actual data
    if report_data.is_empty() {
        return Ok(ReportResponse {
            success: false,
            message: format!(
                "No data found for the specified tracking URLs in campaigns matching '{}'. Please verify your tracking URLs and newsletter type.",
                request.newsletter_type
            ),
            data: None,
            progress_updates,
        });
    }

    // 80% progress
    let finalizing_update = ProgressUpdate {
        stage: "FinalizingReport".to_string(),
        progress: 80,
        message: "Processing complete. Organizing report data...".to_string(),
        time_remaining: Some(15), // Estimate 15 seconds for finalization
    };
    
    // Store and emit update
    progress_updates.push(finalizing_update.clone());
    if let Err(e) = app.emit("report-progress", finalizing_update) {
        println!("Failed to emit progress update: {}", e);
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
        "report_data": report_data,
        "metrics": request.metrics
    });

    println!("Final report metrics: {:?}", request.metrics);
    println!("Final report structure: {:?}", final_report);

    // 90% progress
    let saving_update = ProgressUpdate {
        stage: "SavingReport".to_string(),
        progress: 90,
        message: "Finalizing and saving report...".to_string(),
        time_remaining: Some(5),
    };
    
    // Store and emit update
    progress_updates.push(saving_update.clone());
    if let Err(e) = app.emit("report-progress", saving_update) {
        println!("Failed to emit progress update: {}", e);
    }

    // Save the report with metrics
    let report = SavedReport {
        id: format!("report-{}", chrono::Utc::now().timestamp_millis()),
        name: format!("{}-{}-{}", request.advertiser, request.newsletter_type, chrono::Utc::now().format("%Y-%m-%d")),
        advertiser: request.advertiser,
        report_type: request.newsletter_type,
        date_range: request.date_range.clone(),
        created: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        data: final_report.clone(),
        metrics: request.metrics.clone(),
    };

    println!("About to save report with metrics: {:?}", report.metrics);
    save_report(app.clone(), report.clone())?;

    // Emit report-generated event with the complete report data
    if let Err(e) = app.emit("report-generated", serde_json::json!({
        "report": report
    })) {
        println!("Failed to emit report-generated event: {}", e);
    }

    // 100% progress
    let complete_update = ProgressUpdate {
        stage: "Complete".to_string(),
        progress: 100,
        message: "Report generation complete!".to_string(),
        time_remaining: Some(0),
    };
    
    // Store and emit update
    progress_updates.push(complete_update.clone());
    if let Err(e) = app.emit("report-progress", complete_update) {
        println!("Failed to emit progress update: {}", e);
    }

    Ok(ReportResponse {
        success: true,
        message: "Report generated successfully".to_string(),
        data: Some(final_report),
        progress_updates,
    })
}

#[tauri::command]
fn open_report_in_excel(_window: tauri::Window, reportData: serde_json::Value) -> Result<String, String> {
    // Extract report data for CSV content
    let report_data = reportData.get("data")
        .ok_or_else(|| "Invalid report format: missing data field".to_string())?;
    
    // Get selected metrics from the report data
    let metrics = report_data.get("metrics")
        .ok_or_else(|| "Invalid report format: missing metrics".to_string())?;
    
    // Create CSV header based on selected metrics
    let mut header_fields = vec!["Date"];
    if metrics.get("unique_opens").and_then(|v| v.as_bool()).unwrap_or(false) {
        header_fields.push("Unique Opens");
    }
    if metrics.get("total_opens").and_then(|v| v.as_bool()).unwrap_or(false) {
        header_fields.push("Total Opens");
    }
    if metrics.get("total_recipients").and_then(|v| v.as_bool()).unwrap_or(false) {
        header_fields.push("Total Recipients");
    }
    if metrics.get("total_clicks").and_then(|v| v.as_bool()).unwrap_or(false) {
        header_fields.push("Total Clicks");
    }
    if metrics.get("ctr").and_then(|v| v.as_bool()).unwrap_or(false) {
        header_fields.push("CTR");
    }
    
    // Extract report metadata for filename
    let advertiser = reportData.get("advertiser")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown-advertiser");
    
    let newsletter_type = reportData.get("report_type")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown-type");
    
    // Extract date range for filename
    let date_range = if let Some(range) = reportData.get("date_range") {
        let start = range.get("start_date")
            .and_then(|d| d.as_str())
            .unwrap_or("");
        
        let end = range.get("end_date")
            .and_then(|d| d.as_str())
            .unwrap_or("");
            
        if !start.is_empty() && !end.is_empty() {
            format!("{}_{}", start, end)
        } else {
            "unknown-dates".to_string()
        }
    } else {
        "unknown-dates".to_string()
    };
    
    // Create a timestamp for uniqueness if needed
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    
    // Create a clean advertiser name (remove special chars)
    let clean_advertiser = advertiser.replace(&[' ', ',', '.', '/', '\\', ':', ';', '\"', '\'', '!', '?', '*', '(', ')', '[', ']', '{', '}', '<', '>'][..], "_");
    
    // Get the system temp directory
    let temp_dir = std::env::temp_dir();
    
    // Format the filename: Advertiser_NewsletterType_DateRange.csv
    let file_name = format!("{}_{}_{}_{}.csv", 
        clean_advertiser,
        newsletter_type,
        date_range,
        timestamp
    );
    
    let file_path = temp_dir.join(&file_name);
    
    // Create CSV content with dynamic headers
    let mut csv = String::new();
    csv.push_str(&header_fields.join(","));
    csv.push('\n');
    
    // The report data is now in the "report_data" field
    if let Some(report_entries) = report_data.get("report_data").and_then(|d| d.as_array()) {
        // Report entries are already sorted by date in the backend
        for entry in report_entries {
            let mut row_fields = vec![entry.get("send_date").and_then(|d| d.as_str()).unwrap_or("N/A").to_string()];
            
            if metrics.get("unique_opens").and_then(|v| v.as_bool()).unwrap_or(false) {
                row_fields.push(entry.get("unique_opens").and_then(|v| v.as_u64()).unwrap_or(0).to_string());
            }
            if metrics.get("total_opens").and_then(|v| v.as_bool()).unwrap_or(false) {
                row_fields.push(entry.get("total_opens").and_then(|v| v.as_u64()).unwrap_or(0).to_string());
            }
            if metrics.get("total_recipients").and_then(|v| v.as_bool()).unwrap_or(false) {
                row_fields.push(entry.get("total_recipients").and_then(|v| v.as_u64()).unwrap_or(0).to_string());
            }
            if metrics.get("total_clicks").and_then(|v| v.as_bool()).unwrap_or(false) {
                row_fields.push(entry.get("total_clicks").and_then(|v| v.as_u64()).unwrap_or(0).to_string());
            }
            if metrics.get("ctr").and_then(|v| v.as_bool()).unwrap_or(false) {
                row_fields.push(format!("{:.6}", entry.get("ctr").and_then(|v| v.as_f64()).unwrap_or(0.0)));
            }
            
            csv.push_str(&row_fields.join(","));
            csv.push('\n');
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
    
    // Debug log the download directory
    println!("Using download directory from settings: '{}'", settings.download_directory);
    
    // Use the download directory from settings
    let download_dir = std::path::Path::new(&settings.download_directory);
    
    // Debug log the download directory exists check
    println!("Does download directory exist? {}", download_dir.exists());
    
    // Create the directory if it doesn't exist
    if !download_dir.exists() {
        println!("Download directory doesn't exist, creating it");
        std::fs::create_dir_all(download_dir)
            .map_err(|e| format!("Failed to create download directory: {}", e))?;
    }
    
    // Create a file name with the report name if available
    let report_name = report.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("report");
    
    let file_name = format!("{}_{}.json", report_name, timestamp);
    let file_path = download_dir.join(file_name);
    
    // Debug log the file path
    println!("Writing JSON report to: '{}'", file_path.display());
    
    // Serialize report to JSON
    let report_json = serde_json::to_string_pretty(&report)
        .map_err(|e| format!("Failed to serialize report: {}", e))?;

    // Write to file
    match std::fs::write(&file_path, report_json.as_bytes()) {
        Ok(_) => println!("Successfully wrote JSON file to {}", file_path.display()),
        Err(e) => {
            let error_msg = format!("Failed to write file: {}", e);
            println!("{}", error_msg);
            return Err(error_msg);
        }
    };

    // Return the file path for displaying to the user
    let path_str = file_path.to_string_lossy().to_string();
    println!("Returning file path: '{}'", path_str);
    Ok(path_str)
}

#[tauri::command]
fn download_csv(app: tauri::AppHandle, reportData: serde_json::Value) -> Result<String, String> {
    // Extract report data for CSV content
    let report_data = reportData.get("data")
        .ok_or_else(|| "Invalid report format: missing data field".to_string())?;
    
    // Get selected metrics from the report data
    let metrics = report_data.get("metrics")
        .ok_or_else(|| "Invalid report format: missing metrics".to_string())?;
    
    // Load settings to get the custom download directory
    let settings = load_settings(app.clone())?;
    
    // Use the download directory from settings
    let download_dir = std::path::Path::new(&settings.download_directory);
    
    // Create the directory if it doesn't exist
    if !download_dir.exists() {
        std::fs::create_dir_all(download_dir)
            .map_err(|e| format!("Failed to create download directory: {}", e))?;
    }
    
    // Extract report metadata for filename
    let advertiser = reportData.get("advertiser")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown-advertiser");
    
    let newsletter_type = reportData.get("report_type")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown-type");
    
    // Extract date range for filename
    let date_range = if let Some(range) = reportData.get("date_range") {
        let start = range.get("start_date")
            .and_then(|d| d.as_str())
            .unwrap_or("");
        
        let end = range.get("end_date")
            .and_then(|d| d.as_str())
            .unwrap_or("");
            
        if !start.is_empty() && !end.is_empty() {
            format!("{}_{}", start, end)
        } else {
            "unknown-dates".to_string()
        }
    } else {
        "unknown-dates".to_string()
    };
    
    // Create a timestamp for uniqueness if needed
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    
    // Create a clean advertiser name (remove special chars)
    let clean_advertiser = advertiser.replace(&[' ', ',', '.', '/', '\\', ':', ';', '\"', '\'', '!', '?', '*', '(', ')', '[', ']', '{', '}', '<', '>'][..], "_");
    
    // Format the filename: Advertiser_NewsletterType_DateRange.csv
    let file_name = format!("{}_{}_{}_{}.csv", 
        clean_advertiser,
        newsletter_type,
        date_range,
        timestamp
    );
    
    let file_path = download_dir.join(&file_name);
    
    // Create CSV header based on selected metrics
    let mut header_fields = vec!["Date"];
    if metrics.get("unique_opens").and_then(|v| v.as_bool()).unwrap_or(false) {
        header_fields.push("Unique Opens");
    }
    if metrics.get("total_opens").and_then(|v| v.as_bool()).unwrap_or(false) {
        header_fields.push("Total Opens");
    }
    if metrics.get("total_recipients").and_then(|v| v.as_bool()).unwrap_or(false) {
        header_fields.push("Total Recipients");
    }
    if metrics.get("total_clicks").and_then(|v| v.as_bool()).unwrap_or(false) {
        header_fields.push("Total Clicks");
    }
    if metrics.get("ctr").and_then(|v| v.as_bool()).unwrap_or(false) {
        header_fields.push("CTR");
    }
    
    // Create CSV content with dynamic headers
    let mut csv = String::new();
    csv.push_str(&header_fields.join(","));
    csv.push('\n');
    
    if let Some(report_entries) = report_data.get("report_data").and_then(|d| d.as_array()) {
        for entry in report_entries {
            let mut row_fields = vec![entry.get("send_date").and_then(|d| d.as_str()).unwrap_or("N/A").to_string()];
            
            if metrics.get("unique_opens").and_then(|v| v.as_bool()).unwrap_or(false) {
                row_fields.push(entry.get("unique_opens").and_then(|v| v.as_u64()).unwrap_or(0).to_string());
            }
            if metrics.get("total_opens").and_then(|v| v.as_bool()).unwrap_or(false) {
                row_fields.push(entry.get("total_opens").and_then(|v| v.as_u64()).unwrap_or(0).to_string());
            }
            if metrics.get("total_recipients").and_then(|v| v.as_bool()).unwrap_or(false) {
                row_fields.push(entry.get("total_recipients").and_then(|v| v.as_u64()).unwrap_or(0).to_string());
            }
            if metrics.get("total_clicks").and_then(|v| v.as_bool()).unwrap_or(false) {
                row_fields.push(entry.get("total_clicks").and_then(|v| v.as_u64()).unwrap_or(0).to_string());
            }
            if metrics.get("ctr").and_then(|v| v.as_bool()).unwrap_or(false) {
                row_fields.push(format!("{:.6}", entry.get("ctr").and_then(|v| v.as_f64()).unwrap_or(0.0)));
            }
            
            csv.push_str(&row_fields.join(","));
            csv.push('\n');
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

#[tauri::command]
fn emit_event(app: tauri::AppHandle, event: String, payload: Option<serde_json::Value>) -> Result<(), String> {
    app.emit(&event, payload)
        .map_err(|e| format!("Failed to emit event: {}", e))
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
            get_settings_path,
            emit_event
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

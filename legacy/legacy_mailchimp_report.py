import tkinter as tk
from tkinter import ttk, messagebox
from tkcalendar import Calendar
import requests
import csv
import os
import time
from datetime import datetime, timedelta
from config import api_key, audience_id

# Base URL for Mailchimp API
data_center = api_key.split('-')[-1]
base_url = f'https://{data_center}.api.mailchimp.com/3.0/'

# Headers for API requests
headers = {
    'Authorization': f'Bearer {api_key}'
}

def get_campaigns(start_date, end_date, max_retries=3):
    since_send_time = datetime.strptime(start_date, "%Y-%m-%d").isoformat()
    end_datetime = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) - timedelta(seconds=1)
    before_send_time = end_datetime.isoformat()

    retry_count = 0
    offset = 0
    all_campaigns = []

    while retry_count <= max_retries:
        response = requests.get(
            f"{base_url}campaigns?since_send_time={since_send_time}&before_send_time={before_send_time}&offset={offset}&count=1000", 
            headers=headers
        )

        if response.status_code == 200:
            data = response.json()
            all_campaigns.extend(data['campaigns'])
            if len(data['campaigns']) == 0 or len(all_campaigns) >= data['total_items']:
                break
            else:
                offset += len(data['campaigns'])
        elif response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 60))
            time.sleep(retry_after)
            retry_count += 1
        else:
            return []

    return all_campaigns

def analyze_clicks(campaigns, ad_url_1, ad_url_2=None, max_retries=3):
    report_data = []
    retry_count = 0
    grand_total_opens = 0
    total_recipients = 0

    for campaign in campaigns:
        campaign_id = campaign['id']
        unique_opens = campaign['report_summary'].get('unique_opens', 0)
        total_opens = campaign['report_summary'].get('opens', 0)
        recipients = campaign.get('emails_sent', 0)

        grand_total_opens += total_opens
        total_recipients += recipients

        ad_clicks_1 = 0
        ad_clicks_2 = 0
        send_time = campaign.get('send_time', '')
        formatted_date = datetime.fromisoformat(send_time).strftime('%Y-%m-%d') if send_time else 'N/A'

        offset = 0
        more_data = True

        while more_data:
            click_response = requests.get(
                f"{base_url}reports/{campaign_id}/click-details?offset={offset}&count=1000", 
                headers=headers
            )

            if click_response.status_code == 200:
                click_data = click_response.json()
                for item in click_data['urls_clicked']:
                    if ad_url_1 in item['url']:
                        ad_clicks_1 += item['total_clicks']
                    if ad_url_2 and ad_url_2 in item['url']:
                        ad_clicks_2 += item['total_clicks']

                if click_data['total_items'] > offset + 1000:
                    offset += 1000
                else:
                    more_data = False
            elif click_response.status_code == 429 and retry_count < max_retries:
                retry_after = int(click_response.headers.get("Retry-After", 60))
                time.sleep(retry_after)
                retry_count += 1
                continue
            else:
                more_data = False

        total_clicks = ad_clicks_1 + ad_clicks_2
        ctr = (total_clicks / unique_opens) * 100 if unique_opens > 0 else 0

        # **New Logic: Only add to report if ad link was clicked**
        if ad_clicks_1 > 0 or ad_clicks_2 > 0:
            report_data.append({
                'send_date': formatted_date,
                'unique_opens': unique_opens,
                'total_opens': total_opens,
                'total_recipients': recipients,
                'total_clicks': total_clicks,
                'ctr': ctr
            })

    return report_data, grand_total_opens, total_recipients

def display_report(report_data, total_opens, total_recipients, csv_filename, selected_metrics):
    if not csv_filename.endswith('.csv'):
        csv_filename += '.csv'

    sorted_report_data = sorted(report_data, key=lambda x: x['send_date'])

    with open(csv_filename, mode='w', newline='') as file:
        writer = csv.writer(file)
        
        headers = ['Date']
        for metric, var in selected_metrics.items():
            if var.get():
                headers.append(metric.replace('_', ' ').title())
        writer.writerow(headers)

        for data in sorted_report_data:
            row = [data['send_date']]
            for metric, var in selected_metrics.items():
                if var.get():
                    row.append(data[metric])
            writer.writerow(row)

    print(f"Report successfully saved to {csv_filename}")

def run_script(newsletter_type, start_date, end_date, ad_url_1, ad_url_2, csv_filename, selected_metrics):
    campaigns = get_campaigns(start_date, end_date)
    
    # Updated filtering logic to combine HC and Health Care
    def filter_campaign(campaign):
        title = campaign['settings']['title'].lower()
        if newsletter_type.lower() == "hc":
            return "hc" in title or "health care" in title
        return newsletter_type.lower() in title
    
    filtered_campaigns = [campaign for campaign in campaigns if filter_campaign(campaign)]
    report_data, total_opens, total_recipients = analyze_clicks(filtered_campaigns, ad_url_1, ad_url_2)

    if report_data:
        display_report(report_data, total_opens, total_recipients, csv_filename, selected_metrics)
        messagebox.showinfo("Success", "Report generated successfully!")
    else:
        messagebox.showwarning("No Data", "No data found for the given criteria.")

def main():
    root = tk.Tk()
    root.title("Mailchimp Campaign Analyzer")
    root.geometry("600x800")
    root.configure(bg='#f0f0f0')

    # Create main container with scrollbar
    container = ttk.Frame(root)
    container.pack(fill=tk.BOTH, expand=True)

    # Create canvas and scrollbar
    canvas = tk.Canvas(container, bg='#f0f0f0')
    scrollbar = ttk.Scrollbar(container, orient="vertical", command=canvas.yview)
    scrollable_frame = ttk.Frame(canvas)

    # Configure scrolling
    scrollable_frame.bind(
        "<Configure>",
        lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
    )

    canvas.create_window((0, 0), window=scrollable_frame, anchor="nw", width=560)
    canvas.configure(yscrollcommand=scrollbar.set)

    # Pack the scrollbar and canvas
    scrollbar.pack(side="right", fill="y")
    canvas.pack(side="left", fill="both", expand=True)

    # Create main frame with padding and styling
    main_frame = ttk.Frame(scrollable_frame, padding="20")
    main_frame.pack(fill=tk.BOTH, expand=True)

    # Style configuration
    style = ttk.Style()
    style.configure('TLabel', font=('Helvetica', 10))
    style.configure('TButton', font=('Helvetica', 10))
    style.configure('TEntry', font=('Helvetica', 10))
    style.configure('TCheckbutton', font=('Helvetica', 10))

    # Newsletter Type Selection
    newsletter_frame = ttk.LabelFrame(main_frame, text="Newsletter Type", padding="10")
    newsletter_frame.pack(fill=tk.X, pady=(0, 10))
    
    newsletter_type_var = tk.StringVar()
    newsletter_type_combobox = ttk.Combobox(newsletter_frame, textvariable=newsletter_type_var, 
                                          state="readonly", width=30,
                                          values=("AM", "PM", "Energy", "HC", "Breaking News"))
    newsletter_type_combobox.pack(fill=tk.X)
    newsletter_type_combobox.current(0)

    # Date Selection
    date_frame = ttk.LabelFrame(main_frame, text="Date Range", padding="10")
    date_frame.pack(fill=tk.X, pady=(0, 10))

    start_frame = ttk.Frame(date_frame)
    start_frame.pack(fill=tk.X, pady=(0, 5))
    ttk.Label(start_frame, text="Start Date:").pack(side=tk.LEFT)
    start_cal = Calendar(start_frame, selectmode='day', date_pattern="y-mm-dd", width=20)
    start_cal.pack(side=tk.LEFT, padx=5)

    end_frame = ttk.Frame(date_frame)
    end_frame.pack(fill=tk.X)
    ttk.Label(end_frame, text="End Date:").pack(side=tk.LEFT)
    end_cal = Calendar(end_frame, selectmode='day', date_pattern="y-mm-dd", width=20)
    end_cal.pack(side=tk.LEFT, padx=5)

    # URL Inputs
    url_frame = ttk.LabelFrame(main_frame, text="Ad URLs", padding="10")
    url_frame.pack(fill=tk.X, pady=(0, 10))

    ttk.Label(url_frame, text="Ad URL 1:").pack(anchor=tk.W)
    ad_url_entry_1 = ttk.Entry(url_frame)
    ad_url_entry_1.pack(fill=tk.X, pady=(0, 5))

    ttk.Label(url_frame, text="Ad URL 2:").pack(anchor=tk.W)
    ad_url_entry_2 = ttk.Entry(url_frame)
    ad_url_entry_2.pack(fill=tk.X)

    # CSV Filename
    csv_frame = ttk.LabelFrame(main_frame, text="Output", padding="10")
    csv_frame.pack(fill=tk.X, pady=(0, 10))

    ttk.Label(csv_frame, text="CSV File Name:").pack(anchor=tk.W)
    csv_filename_entry = ttk.Entry(csv_frame)
    csv_filename_entry.pack(fill=tk.X)

    # Metrics Selection
    metrics_frame = ttk.LabelFrame(main_frame, text="Report Metrics", padding="10")
    metrics_frame.pack(fill=tk.X, pady=(0, 10))

    selected_metrics = {
        'unique_opens': tk.BooleanVar(value=True),
        'total_opens': tk.BooleanVar(value=True),
        'total_recipients': tk.BooleanVar(value=True),
        'total_clicks': tk.BooleanVar(value=True),
        'ctr': tk.BooleanVar(value=True)
    }

    for metric, var in selected_metrics.items():
        ttk.Checkbutton(metrics_frame, text=metric.replace('_', ' ').title(), 
                       variable=var).pack(anchor=tk.W)

    # Run Button
    run_button = ttk.Button(main_frame, text="Generate Report", 
                           command=lambda: run_script(
                               newsletter_type_var.get(), 
                               start_cal.get_date(), 
                               end_cal.get_date(),
                               ad_url_entry_1.get(), 
                               ad_url_entry_2.get(), 
                               csv_filename_entry.get(), 
                               selected_metrics
                           ))
    run_button.pack(pady=20)

    root.mainloop()

if __name__ == "__main__":
    main()

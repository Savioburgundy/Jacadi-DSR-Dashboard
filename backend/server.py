from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import csv
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'jacadi-dsr-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="Jacadi DSR Dashboard API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "user"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class SalesTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    transaction_type: str  # IV, IR, SR
    transaction_date: str
    store_location: str
    sales_channel: str
    gross_quantity: int = 0
    returned_quantity: int = 0
    net_quantity: int = 0
    gross_value: float = 0.0
    nett_invoice_value: float = 0.0
    customer_name: Optional[str] = None
    product_sku: Optional[str] = None
    product_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FootfallData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    store_location: str
    footfall_count: int
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SyncLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sync_type: str
    status: str
    records_processed: int = 0
    error_message: Optional[str] = None
    triggered_by: str
    started_at: str
    completed_at: Optional[str] = None

class DashboardMetrics(BaseModel):
    net_revenue: float
    net_quantity: int
    transaction_count: int
    atv: float
    basket_size: float
    multies_percentage: float
    conversion_percentage: float

class DateRangeFilter(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    store_location: Optional[str] = None
    sales_channel: Optional[str] = None

# ============== AUTH HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    hashed_pw = hash_password(user_data.password)
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hashed_pw,
        "name": user_data.name,
        "role": user_data.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email, user_data.role)
    
    user_response = UserResponse(
        id=user_id,
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        created_at=user_doc["created_at"]
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user["id"], user["email"], user["role"])
    
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        created_at=user["created_at"]
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        role=current_user["role"],
        created_at=current_user["created_at"]
    )

# ============== DASHBOARD METRICS ==============

@api_router.get("/dashboard/metrics", response_model=DashboardMetrics)
async def get_dashboard_metrics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    store_location: Optional[str] = None,
    sales_channel: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    # Build filter query
    query = {"transaction_type": {"$in": ["IV", "IR"]}}
    
    if start_date:
        query["transaction_date"] = {"$gte": start_date}
    if end_date:
        if "transaction_date" in query:
            query["transaction_date"]["$lte"] = end_date
        else:
            query["transaction_date"] = {"$lte": end_date}
    if store_location:
        query["store_location"] = store_location
    if sales_channel:
        query["sales_channel"] = sales_channel
    
    # Get all matching transactions
    transactions = await db.sales_transactions.find(query, {"_id": 0}).to_list(100000)
    
    if not transactions:
        return DashboardMetrics(
            net_revenue=0.0,
            net_quantity=0,
            transaction_count=0,
            atv=0.0,
            basket_size=0.0,
            multies_percentage=0.0,
            conversion_percentage=0.0
        )
    
    # Calculate Net Revenue and Net Quantity
    net_revenue = sum(t.get("nett_invoice_value", 0) for t in transactions)
    net_quantity = sum(t.get("net_quantity", 0) for t in transactions)
    
    # Group by invoice number for transaction count (exclude SR prefixes)
    unique_invoices = set()
    invoice_quantities = {}
    
    for t in transactions:
        inv = t.get("invoice_number", "")
        if not inv.startswith("SR"):
            unique_invoices.add(inv)
            if inv not in invoice_quantities:
                invoice_quantities[inv] = 0
            invoice_quantities[inv] += t.get("net_quantity", 0)
    
    transaction_count = len(unique_invoices)
    
    # Calculate efficiency metrics
    atv = net_revenue / transaction_count if transaction_count > 0 else 0.0
    basket_size = net_quantity / transaction_count if transaction_count > 0 else 0.0
    
    # Multies % = transactions with net_quantity > 1
    multies_count = sum(1 for qty in invoice_quantities.values() if qty > 1)
    multies_percentage = (multies_count / transaction_count * 100) if transaction_count > 0 else 0.0
    
    # Get footfall for conversion calculation
    footfall_query = {}
    if start_date:
        footfall_query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in footfall_query:
            footfall_query["date"]["$lte"] = end_date
        else:
            footfall_query["date"] = {"$lte": end_date}
    if store_location:
        footfall_query["store_location"] = store_location
    
    footfall_records = await db.footfall_data.find(footfall_query, {"_id": 0}).to_list(10000)
    total_footfall = sum(f.get("footfall_count", 0) for f in footfall_records)
    
    conversion_percentage = (transaction_count / total_footfall * 100) if total_footfall > 0 else 0.0
    
    return DashboardMetrics(
        net_revenue=round(net_revenue, 2),
        net_quantity=net_quantity,
        transaction_count=transaction_count,
        atv=round(atv, 2),
        basket_size=round(basket_size, 2),
        multies_percentage=round(multies_percentage, 2),
        conversion_percentage=round(conversion_percentage, 2)
    )

@api_router.get("/dashboard/comparison")
async def get_comparison_metrics(
    current_user: dict = Depends(get_current_user)
):
    """Get MTD vs Last Month and YTD vs Last Year comparison"""
    now = datetime.now(timezone.utc)
    
    # MTD dates
    mtd_start = now.replace(day=1).strftime("%Y-%m-%d")
    mtd_end = now.strftime("%Y-%m-%d")
    
    # Last month dates
    last_month = now.replace(day=1) - timedelta(days=1)
    lm_start = last_month.replace(day=1).strftime("%Y-%m-%d")
    lm_end = last_month.strftime("%Y-%m-%d")
    
    # YTD dates
    ytd_start = now.replace(month=1, day=1).strftime("%Y-%m-%d")
    ytd_end = now.strftime("%Y-%m-%d")
    
    # Last year dates
    ly_start = now.replace(year=now.year - 1, month=1, day=1).strftime("%Y-%m-%d")
    ly_end = now.replace(year=now.year - 1).strftime("%Y-%m-%d")
    
    async def get_period_totals(start: str, end: str):
        query = {
            "transaction_type": {"$in": ["IV", "IR"]},
            "transaction_date": {"$gte": start, "$lte": end}
        }
        transactions = await db.sales_transactions.find(query, {"_id": 0}).to_list(100000)
        
        revenue = sum(t.get("nett_invoice_value", 0) for t in transactions)
        quantity = sum(t.get("net_quantity", 0) for t in transactions)
        invoices = set(t.get("invoice_number") for t in transactions if not t.get("invoice_number", "").startswith("SR"))
        
        return {
            "revenue": round(revenue, 2),
            "quantity": quantity,
            "transactions": len(invoices)
        }
    
    mtd_data = await get_period_totals(mtd_start, mtd_end)
    lm_data = await get_period_totals(lm_start, lm_end)
    ytd_data = await get_period_totals(ytd_start, ytd_end)
    ly_data = await get_period_totals(ly_start, ly_end)
    
    def calc_change(current, previous):
        if previous == 0:
            return 0
        return round((current - previous) / previous * 100, 2)
    
    return {
        "mtd": mtd_data,
        "last_month": lm_data,
        "mtd_change": {
            "revenue": calc_change(mtd_data["revenue"], lm_data["revenue"]),
            "quantity": calc_change(mtd_data["quantity"], lm_data["quantity"]),
            "transactions": calc_change(mtd_data["transactions"], lm_data["transactions"])
        },
        "ytd": ytd_data,
        "last_year": ly_data,
        "ytd_change": {
            "revenue": calc_change(ytd_data["revenue"], ly_data["revenue"]),
            "quantity": calc_change(ytd_data["quantity"], ly_data["quantity"]),
            "transactions": calc_change(ytd_data["transactions"], ly_data["transactions"])
        }
    }

@api_router.get("/dashboard/chart-data")
async def get_chart_data(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    store_location: Optional[str] = None,
    sales_channel: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get daily aggregated data for charts"""
    query = {"transaction_type": {"$in": ["IV", "IR"]}}
    
    if start_date:
        query["transaction_date"] = {"$gte": start_date}
    if end_date:
        if "transaction_date" in query:
            query["transaction_date"]["$lte"] = end_date
        else:
            query["transaction_date"] = {"$lte": end_date}
    if store_location:
        query["store_location"] = store_location
    if sales_channel:
        query["sales_channel"] = sales_channel
    
    transactions = await db.sales_transactions.find(query, {"_id": 0}).to_list(100000)
    
    # Aggregate by date
    daily_data = {}
    for t in transactions:
        date = t.get("transaction_date", "")
        if date not in daily_data:
            daily_data[date] = {"date": date, "revenue": 0, "quantity": 0, "transactions": set()}
        daily_data[date]["revenue"] += t.get("nett_invoice_value", 0)
        daily_data[date]["quantity"] += t.get("net_quantity", 0)
        if not t.get("invoice_number", "").startswith("SR"):
            daily_data[date]["transactions"].add(t.get("invoice_number"))
    
    result = []
    for date, data in sorted(daily_data.items()):
        result.append({
            "date": date,
            "revenue": round(data["revenue"], 2),
            "quantity": data["quantity"],
            "transactions": len(data["transactions"])
        })
    
    return result

@api_router.get("/dashboard/by-store")
async def get_data_by_store(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get metrics grouped by store location"""
    query = {"transaction_type": {"$in": ["IV", "IR"]}}
    
    if start_date:
        query["transaction_date"] = {"$gte": start_date}
    if end_date:
        if "transaction_date" in query:
            query["transaction_date"]["$lte"] = end_date
        else:
            query["transaction_date"] = {"$lte": end_date}
    
    transactions = await db.sales_transactions.find(query, {"_id": 0}).to_list(100000)
    
    store_data = {}
    for t in transactions:
        store = t.get("store_location", "Unknown")
        if store not in store_data:
            store_data[store] = {"store": store, "revenue": 0, "quantity": 0, "invoices": set()}
        store_data[store]["revenue"] += t.get("nett_invoice_value", 0)
        store_data[store]["quantity"] += t.get("net_quantity", 0)
        if not t.get("invoice_number", "").startswith("SR"):
            store_data[store]["invoices"].add(t.get("invoice_number"))
    
    result = []
    for store, data in store_data.items():
        result.append({
            "store": store,
            "revenue": round(data["revenue"], 2),
            "quantity": data["quantity"],
            "transactions": len(data["invoices"])
        })
    
    return result

@api_router.get("/dashboard/by-channel")
async def get_data_by_channel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get metrics grouped by sales channel"""
    query = {"transaction_type": {"$in": ["IV", "IR"]}}
    
    if start_date:
        query["transaction_date"] = {"$gte": start_date}
    if end_date:
        if "transaction_date" in query:
            query["transaction_date"]["$lte"] = end_date
        else:
            query["transaction_date"] = {"$lte": end_date}
    
    transactions = await db.sales_transactions.find(query, {"_id": 0}).to_list(100000)
    
    channel_data = {}
    for t in transactions:
        channel = t.get("sales_channel", "Unknown")
        if channel not in channel_data:
            channel_data[channel] = {"channel": channel, "revenue": 0, "quantity": 0, "invoices": set()}
        channel_data[channel]["revenue"] += t.get("nett_invoice_value", 0)
        channel_data[channel]["quantity"] += t.get("net_quantity", 0)
        if not t.get("invoice_number", "").startswith("SR"):
            channel_data[channel]["invoices"].add(t.get("invoice_number"))
    
    result = []
    for channel, data in channel_data.items():
        result.append({
            "channel": channel,
            "revenue": round(data["revenue"], 2),
            "quantity": data["quantity"],
            "transactions": len(data["invoices"])
        })
    
    return result

# ============== DATA MANAGEMENT ==============

@api_router.post("/data/upload-sales")
async def upload_sales_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_admin)
):
    """Upload and process sales CSV with deduplication"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")
    
    content = await file.read()
    decoded = content.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(decoded))
    
    records = []
    invoice_numbers = set()
    
    # Store mapping
    store_mapping = {
        "JACADI PALLADIUM": "Jacadi Palladium",
        "JACADI MOA": "Jacadi MOA",
        "SHOPIFY WEBSTORE": "Shopify Webstore",
        "PALLADIUM": "Jacadi Palladium",
        "MOA": "Jacadi MOA",
        "WEBSTORE": "Shopify Webstore",
        "SHOPIFY": "Shopify Webstore"
    }
    
    channel_mapping = {
        "STORE": "Store",
        "E-COM": "E-com",
        "ECOM": "E-com",
        "WHATSAPP": "WhatsApp",
        "WA": "WhatsApp"
    }
    
    for row in reader:
        try:
            invoice_num = row.get("Invoice Number", row.get("invoice_number", row.get("InvoiceNumber", "")))
            if not invoice_num:
                continue
            
            invoice_numbers.add(invoice_num)
            
            # Parse transaction type
            trans_type = row.get("Transaction Type", row.get("trans_type", row.get("Type", "IV")))
            
            # Parse store location
            store_raw = row.get("Store", row.get("store_location", row.get("Location", ""))).upper()
            store_location = store_mapping.get(store_raw, store_raw.title() if store_raw else "Unknown")
            
            # Parse sales channel
            channel_raw = row.get("Channel", row.get("sales_channel", row.get("SalesChannel", "Store"))).upper()
            sales_channel = channel_mapping.get(channel_raw, channel_raw.title() if channel_raw else "Store")
            
            # Parse quantities
            gross_qty = int(float(row.get("Gross Quantity", row.get("gross_quantity", row.get("Quantity", 0))) or 0))
            returned_qty = int(float(row.get("Returned Quantity", row.get("returned_quantity", row.get("Returns", 0))) or 0))
            net_qty = int(float(row.get("Net Quantity", row.get("net_quantity", gross_qty - returned_qty)) or 0))
            
            # Parse values
            gross_val = float(row.get("Gross Value", row.get("gross_value", row.get("Amount", 0))) or 0)
            nett_val = float(row.get("Nett Invoice Value", row.get("nett_invoice_value", row.get("NetAmount", gross_val))) or 0)
            
            # Parse date
            date_str = row.get("Transaction Date", row.get("transaction_date", row.get("Date", "")))
            if date_str:
                # Try multiple date formats
                for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"]:
                    try:
                        parsed_date = datetime.strptime(date_str, fmt)
                        date_str = parsed_date.strftime("%Y-%m-%d")
                        break
                    except ValueError:
                        continue
            
            record = SalesTransaction(
                invoice_number=invoice_num,
                transaction_type=trans_type,
                transaction_date=date_str,
                store_location=store_location,
                sales_channel=sales_channel,
                gross_quantity=gross_qty,
                returned_quantity=returned_qty,
                net_quantity=net_qty,
                gross_value=gross_val,
                nett_invoice_value=nett_val,
                customer_name=row.get("Customer", row.get("customer_name", "")),
                product_sku=row.get("SKU", row.get("product_sku", "")),
                product_name=row.get("Product", row.get("product_name", ""))
            )
            records.append(record.model_dump())
        except Exception as e:
            logger.error(f"Error parsing row: {e}")
            continue
    
    if not records:
        raise HTTPException(status_code=400, detail="No valid records found in CSV")
    
    # Deduplication: Delete existing records with same invoice numbers
    await db.sales_transactions.delete_many({"invoice_number": {"$in": list(invoice_numbers)}})
    
    # Insert new records
    await db.sales_transactions.insert_many(records)
    
    # Log the sync
    sync_log = SyncLog(
        sync_type="manual_upload",
        status="completed",
        records_processed=len(records),
        triggered_by=current_user["email"],
        started_at=datetime.now(timezone.utc).isoformat(),
        completed_at=datetime.now(timezone.utc).isoformat()
    )
    await db.sync_logs.insert_one(sync_log.model_dump())
    
    return {
        "message": "Sales data uploaded successfully",
        "records_processed": len(records),
        "invoices_updated": len(invoice_numbers)
    }

@api_router.post("/data/upload-footfall")
async def upload_footfall_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_admin)
):
    """Upload and process footfall CSV"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")
    
    content = await file.read()
    decoded = content.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(decoded))
    
    records = []
    dates_stores = set()
    
    store_mapping = {
        "JACADI PALLADIUM": "Jacadi Palladium",
        "JACADI MOA": "Jacadi MOA",
        "PALLADIUM": "Jacadi Palladium",
        "MOA": "Jacadi MOA"
    }
    
    for row in reader:
        try:
            date_str = row.get("Date", row.get("date", ""))
            store_raw = row.get("Store", row.get("store_location", row.get("Location", ""))).upper()
            store_location = store_mapping.get(store_raw, store_raw.title() if store_raw else "Unknown")
            footfall = int(float(row.get("Footfall", row.get("footfall_count", row.get("Count", 0))) or 0))
            
            if date_str:
                for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"]:
                    try:
                        parsed_date = datetime.strptime(date_str, fmt)
                        date_str = parsed_date.strftime("%Y-%m-%d")
                        break
                    except ValueError:
                        continue
            
            dates_stores.add((date_str, store_location))
            
            record = FootfallData(
                date=date_str,
                store_location=store_location,
                footfall_count=footfall
            )
            records.append(record.model_dump())
        except Exception as e:
            logger.error(f"Error parsing footfall row: {e}")
            continue
    
    if not records:
        raise HTTPException(status_code=400, detail="No valid records found in CSV")
    
    # Delete existing records for same date-store combinations
    for date_str, store in dates_stores:
        await db.footfall_data.delete_many({"date": date_str, "store_location": store})
    
    # Insert new records
    await db.footfall_data.insert_many(records)
    
    return {
        "message": "Footfall data uploaded successfully",
        "records_processed": len(records)
    }

@api_router.get("/data/sync-logs")
async def get_sync_logs(
    limit: int = Query(default=20, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get recent sync logs"""
    logs = await db.sync_logs.find({}, {"_id": 0}).sort("started_at", -1).to_list(limit)
    return logs

@api_router.get("/data/transactions")
async def get_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    store_location: Optional[str] = None,
    sales_channel: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    skip: int = Query(default=0),
    current_user: dict = Depends(get_current_user)
):
    """Get sales transactions with filtering"""
    query = {}
    
    if start_date:
        query["transaction_date"] = {"$gte": start_date}
    if end_date:
        if "transaction_date" in query:
            query["transaction_date"]["$lte"] = end_date
        else:
            query["transaction_date"] = {"$lte": end_date}
    if store_location:
        query["store_location"] = store_location
    if sales_channel:
        query["sales_channel"] = sales_channel
    
    total = await db.sales_transactions.count_documents(query)
    transactions = await db.sales_transactions.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    return {
        "total": total,
        "transactions": transactions
    }

# ============== CONFIG ENDPOINTS ==============

@api_router.get("/config/stores")
async def get_stores():
    """Get available store locations"""
    return ["Jacadi Palladium", "Jacadi MOA", "Shopify Webstore"]

@api_router.get("/config/channels")
async def get_channels():
    """Get available sales channels"""
    return ["Store", "E-com", "WhatsApp"]

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "Jacadi DSR Dashboard API", "status": "healthy"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

"""
TrustMesh — Pricing Agent
==========================
Handles pricing-related tasks, market price discovery,
and budget-constrained product segment analysis.
"""

import asyncio
import re
from typing import Optional, Dict, Any


# Authoritative reference catalog for verified standard products
PRODUCT_PRICES = {
    "laptop x": {"price": 59999, "currency": "INR", "source": "Official Retail Price"},
    "macbook pro": {"price": 169900, "currency": "INR", "source": "Apple India"},
    "macbook air": {"price": 114900, "currency": "INR", "source": "Apple India"},
    "iphone 16": {"price": 79900, "currency": "INR", "source": "Apple India"},
    "iphone 15": {"price": 69900, "currency": "INR", "source": "Apple India"},
    "samsung galaxy s24": {"price": 74999, "currency": "INR", "source": "Samsung India"},
    "dell xps 13": {"price": 89990, "currency": "INR", "source": "Dell India"},
    "rtx 4090": {"price": 159999, "currency": "INR", "source": "Nvidia Authorized Partner"},
    "pixel 8": {"price": 75999, "currency": "INR", "source": "Google Store India"},
    "ipad air": {"price": 59900, "currency": "INR", "source": "Apple India"},
}

# Category market segment data for budget queries (e.g. under ₹30,000)
CATEGORY_TIERS = {
    "smartphone": [
        {"model": "OnePlus Nord CE4", "price": 24999, "specs": "8GB RAM / 128GB, Snapdragon 7 Gen 3"},
        {"model": "Redmi Note 13 Pro 5G", "price": 25999, "specs": "8GB RAM / 256GB, 200MP Camera"},
        {"model": "Samsung Galaxy M55 5G", "price": 26999, "specs": "8GB RAM / 128GB, Super AMOLED+"},
        {"model": "iQOO Z9 5G", "price": 19999, "specs": "8GB RAM / 128GB, Dimensity 7200"},
        {"model": "Realme 12 Pro 5G", "price": 23999, "specs": "8GB RAM / 128GB, Telephoto Lens"},
    ],
    "laptop": [
        {"model": "Lenovo IdeaPad Slim 3", "price": 49990, "specs": "Core i5 12th Gen, 16GB RAM, 512GB SSD"},
        {"model": "ASUS Vivobook 15", "price": 52990, "specs": "Core i5 12th Gen, 16GB RAM, 512GB SSD"},
        {"model": "HP 15s", "price": 54990, "specs": "Ryzen 5 5500U, 16GB RAM, 512GB SSD"},
        {"model": "Acer Aspire Lite", "price": 38990, "specs": "Core i3 12th Gen, 8GB RAM, 512GB SSD"},
    ]
}

MALICIOUS_PRICE_OFFSET = -10000


class PricingAgent:
    """
    AI agent specialized in pricing information and budget segment analysis.
    Provides verifiable market pricing without hardcoded fallbacks.
    """

    def __init__(self):
        self.agent_id = "agent-pricing-001"
        self.agent_name = "Pricing Agent"
        self.agent_type = "pricing"

    async def execute(
        self,
        task_description: str,
        demo_mode: Optional[str] = None
    ) -> dict:
        """
        Execute a pricing task dynamically based on user's query.

        Args:
            task_description: The task to perform (e.g., "Find price of iPhone 16" or "smartphone under ₹30,000")
            demo_mode: None = normal, "success" = returns correct price,
                      "failure" = returns intentionally wrong price

        Returns:
            dict with result, structured_data, and agent metadata
        """
        await asyncio.sleep(0.5)

        desc_clean = task_description.strip()
        desc_lower = desc_clean.lower()

        # -------------------------------------------------------------
        # 1. Budget Category Query (e.g. "smartphone under ₹30,000")
        # -------------------------------------------------------------
        budget_match = self._extract_budget_and_category(desc_lower)
        if budget_match:
            category, max_budget = budget_match
            candidates = CATEGORY_TIERS.get(category, [])
            filtered = [c for c in candidates if c["price"] <= max_budget]

            if filtered:
                filtered.sort(key=lambda x: x["price"], reverse=True)
                top_pick = filtered[0]
                price = top_pick["price"]

                if demo_mode == "failure":
                    # Malicious failure mode: report price that violates budget or is corrupted
                    reported_price = max_budget + 15000
                    result_text = f"Market pricing for {category} under ₹{max_budget:,}: Top model '{top_pick['model']}' at ₹{reported_price:,}."
                    is_malicious = True
                    mode_note = "⚠️ MALICIOUS MODE: Agent returned budget-exceeding price"
                else:
                    reported_price = price
                    model_list_str = "; ".join(f"{c['model']} (₹{c['price']:,})" for c in filtered[:3])
                    result_text = (
                        f"Current market pricing for {category}s under ₹{max_budget:,}: "
                        f"Top recommendation is '{top_pick['model']}' at ₹{reported_price:,}. "
                        f"Available verified models in this band include: {model_list_str}."
                    )
                    is_malicious = False
                    mode_note = "Normal operation"

                return {
                    "agent_id": self.agent_id,
                    "agent_name": self.agent_name,
                    "task_description": task_description,
                    "result": result_text,
                    "structured_data": {
                        "price": reported_price,
                        "currency": "INR",
                        "unit": "INR",
                        "product": f"{category.title()} under ₹{max_budget:,}",
                        "category": category,
                        "budget_cap": max_budget,
                        "top_model": top_pick["model"],
                        "models_in_budget": [c["model"] for c in filtered],
                        "source": "Aggregated E-Commerce Market Index",
                        "is_malicious": is_malicious,
                        "query_type": "budget_category"
                    },
                    "confidence": 65 if is_malicious else 95,
                    "mode_note": mode_note
                }

        # -------------------------------------------------------------
        # 2. Specific Catalog Product Query (e.g. "iPhone 16", "MacBook Pro")
        # -------------------------------------------------------------
        product_key = self._extract_product(task_description)

        if product_key and product_key in PRODUCT_PRICES:
            price_data = PRODUCT_PRICES[product_key]
            correct_price = price_data["price"]
            currency = price_data["currency"]
            source = price_data["source"]

            if demo_mode == "failure":
                reported_price = correct_price + MALICIOUS_PRICE_OFFSET
                mode_note = "⚠️ MALICIOUS MODE: Agent returned manipulated price"
                is_malicious = True
            else:
                reported_price = correct_price
                mode_note = "Normal operation"
                is_malicious = False

            result_text = f"Market price for {product_key.title()} is ₹{reported_price:,}."

            return {
                "agent_id": self.agent_id,
                "agent_name": self.agent_name,
                "task_description": task_description,
                "result": result_text,
                "structured_data": {
                    "price": reported_price,
                    "currency": currency,
                    "unit": "INR",
                    "product": product_key.title(),
                    "source": source,
                    "is_malicious": is_malicious,
                    "query_type": "catalog_product"
                },
                "confidence": 65 if is_malicious else 95,
                "mode_note": mode_note,
            }

        # -------------------------------------------------------------
        # 3. Product / Price Unavailable (NO fallback to Laptop X or 59999)
        # -------------------------------------------------------------
        result_text = f"Price unavailable: No verified market pricing found for '{task_description}'."
        return {
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "task_description": task_description,
            "result": result_text,
            "structured_data": {
                "price": None,
                "currency": "INR",
                "unit": "INR",
                "product": task_description,
                "source": "None",
                "status": "PRICE_UNAVAILABLE",
                "is_malicious": False,
                "query_type": "unknown_product"
            },
            "confidence": 0,
            "mode_note": "Price unavailable / unknown product",
        }

    def _extract_product(self, task_description: str) -> Optional[str]:
        """Extract product name from task description."""
        task_lower = task_description.lower()
        sorted_products = sorted(PRODUCT_PRICES.keys(), key=len, reverse=True)
        for product in sorted_products:
            if product in task_lower:
                return product
        return None

    def _extract_budget_and_category(self, desc_lower: str) -> Optional[tuple]:
        """Extract category and budget limit (e.g. 'smartphone under ₹30,000')."""
        # Determine category
        category = None
        if "smartphone" in desc_lower or "phone" in desc_lower or "mobile" in desc_lower:
            category = "smartphone"
        elif "laptop" in desc_lower or "notebook" in desc_lower:
            category = "laptop"

        if not category:
            return None

        # Look for budget pattern like "under ₹30,000", "under 30000", "under rs 60,000", "below 30000"
        m = re.search(r"(?:under|below|less than|within)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)", desc_lower)
        if m:
            clean_num = m.group(1).replace(",", "")
            try:
                budget = float(clean_num)
                return (category, budget)
            except ValueError:
                return None
        return None

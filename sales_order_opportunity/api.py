
import frappe


@frappe.whitelist()
def get_opportunities(txt=""):
    """Search Opportunities using only the main Quotation No."""

    txt = (txt or "").strip()

    if not txt:
        return []

    return frappe.db.sql(
        """
        SELECT
            name,
            custom_quotation,
            customer_name
        FROM `tabOpportunity`
        WHERE IFNULL(custom_quotation, '') LIKE %(txt)s
        ORDER BY modified DESC
        LIMIT 50
        """,
        {
            "txt": f"%{txt}%"
        },
        as_dict=True,
    )


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def search_opportunities_by_quotation(
    doctype, txt, searchfield, start, page_len, filters=None
):
    """
    Link field query for Opportunity.
    Search by custom_quotation, while returning the Opportunity ID
    as the linked document name.
    """

    txt = (txt or "").strip()

    if not txt:
        return []

    return frappe.db.sql(
        """
        SELECT
            name,
            custom_quotation,
            customer_name
        FROM `tabOpportunity`
        WHERE IFNULL(custom_quotation, '') LIKE %(txt)s
        ORDER BY modified DESC
        LIMIT %(start)s, %(page_len)s
        """,
        {
            "txt": f"%{txt}%",
            "start": start,
            "page_len": page_len,
        },
    )


@frappe.whitelist()
def get_opportunity_details(opportunity_name):
    """Fetch Opportunity header details and items for Sales Order."""

    if not opportunity_name:
        frappe.throw("Please select an Opportunity.")

    if not frappe.db.exists("Opportunity", opportunity_name):
        frappe.throw("Opportunity not found.")

    opportunity = frappe.get_doc("Opportunity", opportunity_name)

    # Resolve Customer.
    customer = opportunity.get("custom_customer")

    if (
        not customer
        and opportunity.get("opportunity_from") == "Customer"
    ):
        customer = opportunity.get("party_name")

    # Match Customer by exact customer name if necessary.
    if not customer and opportunity.get("customer_name"):
        matches = frappe.get_all(
            "Customer",
            filters={
                "customer_name": opportunity.get("customer_name")
            },
            fields=["name"],
            limit_page_length=2,
        )

        if len(matches) == 1:
            customer = matches[0].get("name")

    # Prepare Opportunity items.
    items = []

    for row in opportunity.get("items", []):
        items.append({
            "item_code": row.get("item_code"),
            "item_name": row.get("item_name"),
            "description": row.get("description"),
            "qty": row.get("qty"),
            "uom": row.get("uom"),
            "brand": row.get("brand"),
            "item_group": row.get("item_group"),
            "image": row.get("image"),
            "rate": row.get("rate"),
        })

    return {
        "name": opportunity.name,

        # Main Quotation No from Opportunity.
        "custom_quotation": opportunity.get("custom_quotation"),

        # Customer information.
        "customer": customer,
        "customer_name": opportunity.get("customer_name"),

        # Header field mappings.
        "custom_order_booking_category": opportunity.get(
            "custom_order_booking_category"
        ),
        "custom_type_of_entity": opportunity.get(
            "custom_type_of_entity"
        ),
        "custom_customer_type": opportunity.get(
            "custom_customer_type"
        ),
        "custom_enquriry_type": opportunity.get(
            "enquriry_type"
        ),
        "custom_group_unit": opportunity.get(
            "custom_group_unit"
        ),
        "custom_qtn_date": opportunity.get(
            "custom_qtn_date"
        ),
        "custom_project_client": opportunity.get(
            "custom_project_client"
        ),
        "custom_po_no": opportunity.get(
            "custom_po_no"
        ),
        "custom_po_date": opportunity.get(
            "custom_po_date"
        ),

        # Item details.
        "items": items,
    }

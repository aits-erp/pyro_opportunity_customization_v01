
frappe.ui.form.on("Sales Order", {
    refresh(frm) {
        add_opportunity_menu(frm);
    }
});

function add_opportunity_menu(frm) {
    frm.add_custom_button(
        __("Opportunity"),
        function () {
            show_opportunity_dialog(frm);
        },
        __("Get Items From")
    );
}

function show_opportunity_dialog(frm) {
    let selecting = false;

    const dialog = new frappe.ui.Dialog({
        title: __("Get Items From Opportunity"),
        size: "large",
        fields: [
            {
                fieldname: "opportunity",
                label: __("Quotation No"),
                fieldtype: "Link",
                options: "Opportunity",
                description: __(
                    "Search using the main Quotation No stored in the Opportunity."
                ),
                get_query() {
                    return {
                        query: "sales_order_opportunity.api.search_opportunities_by_quotation"
                    };
                },
                onchange() {
                    const opportunity_name =
                        dialog.get_value("opportunity");

                    if (!opportunity_name || selecting) {
                        return;
                    }

                    selecting = true;

                    select_opportunity(
                        opportunity_name,
                        dialog,
                        frm,
                        () => {
                            selecting = false;
                        }
                    );
                }
            },
            {
                fieldname: "opportunity_details",
                fieldtype: "HTML"
            }
        ],
        primary_action_label: __("Close"),
        primary_action() {
            dialog.hide();
        }
    });

    dialog.show();
}

function select_opportunity(
    opportunity_name,
    dialog,
    frm,
    done
) {
    frappe.call({
        method: "sales_order_opportunity.api.get_opportunity_details",
        args: {
            opportunity_name: opportunity_name
        },
        freeze: true,
        freeze_message: __("Fetching Opportunity details..."),

        callback(r) {
            if (r.exc || !r.message) {
                if (done) done();
                return;
            }

            const data = r.message;

            if (!data.customer) {
                frappe.msgprint({
                    title: __("Customer Missing"),
                    indicator: "red",
                    message: __(
                        "Could not determine the Customer for Opportunity {0}. Please check the Customer fields on the Opportunity.",
                        [data.name]
                    )
                });

                if (done) done();
                return;
            }

            const apply = () => {
                apply_opportunity(frm, data, dialog)
                    .finally(() => {
                        if (done) done();
                    });
            };

            if (frm.doc.items && frm.doc.items.length) {
                frappe.confirm(
                    __(
                        "This Sales Order already contains items. Replace them with the selected Opportunity items?"
                    ),
                    apply,
                    () => {
                        if (done) done();
                    }
                );
            } else {
                apply();
            }
        },

        error() {
            if (done) done();
        }
    });
}

async function apply_opportunity(frm, data, dialog) {
    // Set Customer first.
    await frm.set_value("customer", data.customer);

    // Populate fields only if they exist on the current site.
    const headerValues = {
        custom_quotation_no: data.custom_quotation,
        custom_order_booking_category:
            data.custom_order_booking_category,
        custom_type_of_entity: data.custom_type_of_entity,
        custom_customer_type: data.custom_customer_type,
        custom_enquriry_type: data.custom_enquriry_type,
        custom_group_unit: data.custom_group_unit,
        custom_qtn_date: data.custom_qtn_date,
        custom_project_client: data.custom_project_client,
        po_no: data.custom_po_no,
        po_date: data.custom_po_date
    };

    for (const [fieldname, value] of Object.entries(headerValues)) {
        if (frappe.meta.has_field("Sales Order", fieldname)) {
            await frm.set_value(fieldname, value || "");
        }
    }

    // Replace existing Sales Order items.
    frm.clear_table("items");

    for (const item of (data.items || [])) {
        const row = frm.add_child("items");

        row.item_code = item.item_code;
        row.item_name = item.item_name;
        row.description = item.description;
        row.qty = item.qty;
        row.uom = item.uom;
        row.brand = item.brand;
        row.item_group = item.item_group;
        row.image = item.image;
        row.rate = item.rate;
    }

    frm.refresh_field("items");

    // Trigger standard ERPNext calculations.
    await frm.trigger("calculate_taxes_and_totals");

    frm.refresh_fields();
    dialog.hide();

    frappe.show_alert({
        message: __(
            "Quotation {0} from Opportunity {1} added to Sales Order",
            [data.custom_quotation || "", data.name]
        ),
        indicator: "green"
    });
}

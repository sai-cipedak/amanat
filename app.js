const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );


async function loadDashboard() {

    const message =
        document.getElementById("message");

    const tbody =
        document.getElementById("kpi-body");


    const { data, error } =
        await supabaseClient
            .from("kpis")
            .select(`
                id,
                title,
                measurement_type,
                baseline,
                target,
                actual,
                unit,
                status,
                mandates (
                    id,
                    title,
                    cluster
                )
            `)
            .eq("is_public", true)
            .order(
                "sort_order",
                { ascending: true }
            );


    if (error) {

        console.error(error);

        message.textContent =
            "Could not load KPI data.";

        return;
    }


    message.textContent = "";


    document
        .getElementById("total-kpis")
        .textContent = data.length;


    data.forEach(kpi => {

        const row =
            document.createElement("tr");


        const values = [

            kpi.title,

            kpi.mandates?.title ?? "-",

            kpi.measurement_type,

            formatValue(
                kpi.baseline,
                kpi.unit
            ),

            formatValue(
                kpi.actual,
                kpi.unit
            ),

            formatValue(
                kpi.target,
                kpi.unit
            ),

            formatStatus(kpi.status)

        ];


        values.forEach(value => {

            const cell =
                document.createElement("td");

            cell.textContent = value;

            row.appendChild(cell);

        });


        tbody.appendChild(row);

    });

}


function formatValue(value, unit) {

    if (
        value === null ||
        value === undefined
    ) {
        return "-";
    }

    return `${value} ${unit ?? ""}`.trim();

}


function formatStatus(status) {

    const labels = {

        not_started: "Not Started",

        on_track: "On Track",

        at_risk: "At Risk",

        off_track: "Off Track",

        completed: "Completed"

    };


    return labels[status] ?? status;

}


loadDashboard();

// tools.js
import twilio from "twilio";

export const tools = [
  {
    name: "search_notes",
    description:
      "Search Culy Contracting's internal FAQ/knowledge base for specific info on services, area, process, or policy.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for" },
      },
      required: ["query"],
    },
  },
  {
    name: "capture_lead",
    description:
      "Save a potential customer's contact info and job description when they ask for a quote or want to book work, and notify the right person at Culy's. Always confirm the details back to the customer after calling this.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Customer's name" },
        phone: { type: "string", description: "Customer's phone number" },
        job_description: { type: "string", description: "What they need done, and any details like location or timeline" },
        job_category: {
          type: "string",
          enum: ["emergency", "utilities", "protective_coatings", "flow_control", "vac_truck_cctv", "general"],
          description: "Which division this job falls under. Use 'emergency' for active leaks, no water service, or sewage backups. Use 'general' if unclear.",
        },
      },
      required: ["name", "phone", "job_description", "job_category"],
    },
  },
];

// ---- Who gets texted for each type of job ----
// ✏️ EDIT THIS tomorrow with real names/numbers.
const CONTACT_ROUTING = {
  emergency: { name: "[EMERGENCY CONTACT NAME]", phone: "+1XXXXXXXXXX" },
  utilities: { name: "[UTILITIES CONTACT NAME]", phone: "+1XXXXXXXXXX" },
  protective_coatings: { name: "[COATINGS CONTACT NAME]", phone: "+1XXXXXXXXXX" },
  flow_control: { name: "[FLOW CONTROL CONTACT NAME]", phone: "+1XXXXXXXXXX" },
  vac_truck_cctv: { name: "[VAC/CCTV CONTACT NAME]", phone: "+1XXXXXXXXXX" },
  general: { name: "[GENERAL CONTACT NAME]", phone: "+1XXXXXXXXXX" },
};

const NOTES = [
  { id: 1, text: "Culy Contracting has been in business since 1978, headquartered in Winchester, Indiana, with additional shops in Saratoga IN, Richmond IN, Indianapolis IN, and Morristown TN." },
  { id: 2, text: "Utilities Division services: water, sanitary sewer, and storm sewer underground utility installation, site grading, and concrete work." },
  { id: 3, text: "Protective Coatings Division services: manhole rehabilitation using Mainstay epoxy liner, and special coatings." },
  { id: 4, text: "Flow Control Division services: line stops, bypasses, insert valves, and hot taps." },
  { id: 5, text: "Vac Truck / CCTV Division services: hydro excavation, CCTV sewer line inspection and televising, jet-vac sewer and storm line cleaning, trenchless internal pipe repairs, and root cutting." },
  { id: 6, text: "Other services: manhole and sewer vacuum testing, low pressure air testing, lift station installation and custom fabrication, concrete coring from 3 to 16 inches, and injection grout sealing for pressure leaks." },
  { id: 7, text: "Service area is primarily the Midwest: Indiana, Ohio, Illinois, Kentucky, and Michigan, with an expanding Southeast presence for manhole rehabilitation and flow control out of Morristown, Tennessee." },
  { id: 8, text: "Culy Contracting primarily serves municipalities, utilities, developers, and commercial/industrial clients." },
  { id: 9, text: "Culy offers 24-hour emergency service for urgent water and sewer issues, in addition to standard Monday-Friday 7am-5pm office hours." },
  { id: 10, text: "Culy Contracting has a 4.4-star average across 57 customer reviews on Google and Facebook, and holds an A+ Better Business Bureau rating." },
  { id: 11, text: "The main office phone number is (765) 584-8509." },
];

const leads = [];

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

async function notifyContact(contact, lead) {
  const message = `New lead (${lead.job_category}):\nName: ${lead.name}\nPhone: ${lead.phone}\nJob: ${lead.job_description}`;

  if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
    console.log("Twilio not configured yet -- lead only logged:", message);
    return { sms: "not_configured" };
  }

  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: contact.phone,
    });
    return { sms: "sent" };
  } catch (err) {
    console.error("SMS failed:", err.message);
    return { sms: "failed" };
  }
}

export async function executeTool(name, input) {
  switch (name) {
    case "search_notes": {
      const q = input.query.toLowerCase();
      const matches = NOTES.filter((n) => n.text.toLowerCase().includes(q));
      return { matches: matches.length ? matches : "no matches found" };
    }

    case "capture_lead": {
      const lead = { ...input, capturedAt: new Date().toISOString() };
      leads.push(lead);
      console.log("NEW LEAD CAPTURED:", lead);

      const contact = CONTACT_ROUTING[lead.job_category] || CONTACT_ROUTING.general;
      const notifyResult = await notifyContact(contact, lead);

      return { confirmed: true, routed_to: contact.name, notify_result: notifyResult, ...input };
    }

    default:
      return { error: `unknown tool: ${name}` };
  }
}

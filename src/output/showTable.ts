import chalk from "chalk";
import Table from "cli-table3";
import { extractDisplayName } from "../ado/workItem.js";
import type { WorkItemDetail, WorkItemComment, WorkItemRelationInfo } from "../ado/workItem.js";
import { formatCellValue } from "./queryTable.js";

const IDENTITY_FIELDS = new Set(["System.AssignedTo", "System.CreatedBy", "System.ChangedBy", "System.AuthorizedAs"]);

const CORE_FIELDS: Array<{ ref: string; label: string }> = [
  { ref: "System.Id", label: "ID" },
  { ref: "System.Title", label: "Title" },
  { ref: "System.WorkItemType", label: "Type" },
  { ref: "System.State", label: "State" },
  { ref: "System.AssignedTo", label: "Assigned To" },
  { ref: "System.AreaPath", label: "Area Path" },
  { ref: "System.IterationPath", label: "Iteration Path" },
  { ref: "Microsoft.VSTS.Common.Priority", label: "Priority" },
  { ref: "Microsoft.VSTS.Common.Severity", label: "Severity" },
  { ref: "System.Tags", label: "Tags" },
  { ref: "System.CreatedBy", label: "Created By" },
  { ref: "System.CreatedDate", label: "Created Date" },
  { ref: "System.ChangedBy", label: "Changed By" },
  { ref: "System.ChangedDate", label: "Changed Date" },
  { ref: "System.Description", label: "Description" }
];

const CORE_FIELD_REFS = new Set(CORE_FIELDS.map((f) => f.ref));

const RELATION_TYPE_MAP: Record<string, string> = {
  "System.LinkTypes.Hierarchy-Forward": "Child",
  "System.LinkTypes.Hierarchy-Reverse": "Parent",
  "System.LinkTypes.Related": "Related",
  "System.LinkTypes.Dependency-Forward": "Successor",
  "System.LinkTypes.Dependency-Reverse": "Predecessor",
  "System.LinkTypes.Duplicate-Forward": "Duplicate",
  "System.LinkTypes.Duplicate-Reverse": "Duplicate Of",
  ArtifactLink: "Artifact Link",
  AttachedFile: "Attachment",
  Hyperlink: "Hyperlink"
};

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function friendlyRelationType(rel: string): string {
  const mapped = RELATION_TYPE_MAP[rel];
  if (mapped) {
    return mapped;
  }
  const match = rel.match(/\.([^.-]+?)(?:-(?:Forward|Reverse))?$/);
  return match?.[1] ?? rel;
}

function formatFieldValue(ref: string, value: unknown): string {
  if (value === null || value === undefined) {
    return chalk.dim("-");
  }
  if (IDENTITY_FIELDS.has(ref)) {
    return extractDisplayName(value) || chalk.dim("-");
  }
  if (ref === "System.Description" && typeof value === "string") {
    return stripHtml(value);
  }
  return formatCellValue(value);
}

function renderFieldsSection(detail: WorkItemDetail): string {
  const table = new Table({
    colWidths: [25, null],
    wordWrap: true,
    style: { head: [], border: [], compact: true }
  });

  for (const { ref, label } of CORE_FIELDS) {
    const value = ref === "System.Id" ? detail.id : detail.fields[ref];
    table.push([chalk.bold(label), formatFieldValue(ref, value)]);
  }

  const additionalFields = Object.entries(detail.fields)
    .filter(([ref]) => !CORE_FIELD_REFS.has(ref))
    .sort(([a], [b]) => a.localeCompare(b));

  if (additionalFields.length > 0) {
    table.push([{ colSpan: 2, content: chalk.bold.dim("── Additional Fields ──") }]);
    for (const [ref, value] of additionalFields) {
      table.push([chalk.dim(ref), formatFieldValue(ref, value)]);
    }
  }

  return table.toString();
}

function renderRelationsSection(relations: WorkItemRelationInfo[]): string {
  if (relations.length === 0) {
    return "";
  }

  const lines: string[] = ["", chalk.bold("Relations")];

  const table = new Table({
    head: [chalk.bold("Type"), chalk.bold("URL / Name"), chalk.bold("Details")],
    wordWrap: true,
    style: { head: [], border: [], compact: true }
  });

  for (const rel of relations) {
    const type = friendlyRelationType(rel.rel);
    const artifactName = rel.rel === "ArtifactLink" ? rel.attributes["name"] : undefined;
    const details = artifactName
      ? String(artifactName)
      : Object.keys(rel.attributes).length > 0
        ? JSON.stringify(rel.attributes)
        : "";
    table.push([type, rel.url, details]);
  }

  lines.push(table.toString());
  return lines.join("\n");
}

function renderCommentsSection(comments: WorkItemComment[]): string {
  if (comments.length === 0) {
    return "";
  }

  const lines: string[] = ["", chalk.bold(`Comments (${comments.length})`)];

  for (const comment of comments) {
    const date = comment.createdDate ? new Date(comment.createdDate).toLocaleString() : "";
    lines.push("");
    lines.push(chalk.cyan(`  ${comment.createdBy}`) + chalk.dim(`  ${date}`));
    const text = comment.format === "html" ? stripHtml(comment.text) : comment.text;
    for (const line of text.split("\n")) {
      lines.push(`  ${line}`);
    }
  }

  return lines.join("\n");
}

export function renderShowTable(detail: WorkItemDetail): string {
  const sections: string[] = [renderFieldsSection(detail)];

  const relations = renderRelationsSection(detail.relations);
  if (relations) {
    sections.push(relations);
  }

  const comments = renderCommentsSection(detail.comments);
  if (comments) {
    sections.push(comments);
  }

  return sections.join("\n");
}

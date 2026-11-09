import {
  NORMAL_USER_ID,
  ORDERS_QUESTION_ID,
} from "e2e/support/cypress_sample_instance_data";
import { uuid } from "metabase/utils/uuid";
import type { CommentId, DocumentId } from "metabase-types/api";

const { H } = cy;
const { Comments } = H;

const IS_MAC = Cypress.platform === "darwin";
const META_KEY = IS_MAC ? "Meta" : "Control";

const HEADING_1_ID = "c2187a62-1093-61ee-3174-0bbe64c8bbfa";
const HEADING_2_ID = "82999d0b-d7a7-c0f8-aedf-6ddf737edf78";
const HEADING_3_ID = "190b1dd2-d875-18ae-0ba0-a13c91630c2b";
const PARAGRAPH_ID = "b7fa322a-964e-d668-8d30-c772ef4f0022";
const BULLET_LIST_ID = "3fd94c59-614d-bce7-37ef-c2f46871679a";
const BLOCKQUOTE_ID = "e785b000-1651-c154-e0bd-7313f839bb50";
const ORDERED_LIST_ID = "12fd2bdb-76f7-d07a-b61e-b2d2eee127b5";
const CODE_BLOCK_ID = "b9fec4be-4b44-2c24-7073-10f23522cfd3";
const CARD_EMBED_ID = "cce109c3-4cec-caf1-a569-89fa15410ae1";

describe("document comments", () => {
  beforeEach(() => {
    H.restore();
    cy.signInAsAdmin();
  });

  it("allows to comment on every type of node", () => {
    cy.intercept("GET", "/api/comment?*").as("comments");
    createAndVisitLoremIpsumDocument();
    cy.wait("@comments");

    cy.log("does not need schema adjustments by default");
    H.getHeading1().should("be.visible");
    cy.findByRole("button", { name: "Save" }).should("not.exist");

    cy.log("does not have any comments by default");
    cy.findByRole("link", { name: "Show all comments" }).should("not.exist");

    cy.get<DocumentId>("@documentId").then((documentId) => {
      testCommentingOnNode(documentId, HEADING_1_ID, H.getHeading1);
      cy.findByRole("link", { name: "Show all comments" })
        .scrollIntoView()
        .should("be.visible");
      testCommentingOnNode(documentId, HEADING_2_ID, H.getHeading2);
      testCommentingOnNode(documentId, HEADING_3_ID, H.getHeading3);
      testCommentingOnNode(documentId, PARAGRAPH_ID, H.getParagraph);
      testCommentingOnNode(documentId, BULLET_LIST_ID, H.getBulletList);
      testCommentingOnNode(documentId, BLOCKQUOTE_ID, H.getBlockquote);
      testCommentingOnNode(documentId, ORDERED_LIST_ID, H.getOrderedList);
      testCommentingOnNode(documentId, CODE_BLOCK_ID, H.getCodeBlock);
      testCommentingOnNode(documentId, CARD_EMBED_ID, H.getEmbed, {
        isCardEmbedNode: true,
      });
    });

    function testCommentingOnNode<E extends HTMLElement>(
      targetId: DocumentId,
      childTargetId: string,
      getNodeElement: () => Cypress.Chainable<JQuery<E>>,
      { isCardEmbedNode = false } = {},
    ) {
      cy.get("body").click(0, 0);

      if (isCardEmbedNode) {
        getNodeElement().scrollIntoView();
        getNodeElement().icon("ellipsis").click();

        H.menu().findByText("Comment").click();
      } else {
        Comments.getDocumentNodeButton({ targetId, childTargetId }).should(
          "not.be.visible",
        );

        getNodeElement()
          .closest("[data-node-view-wrapper]")
          .should("have.attr", "aria-expanded", "false");
        getNodeElement().scrollIntoView();
        getNodeElement().realHover();
        Comments.getDocumentNodeButton({ targetId, childTargetId })
          .should("be.visible")
          .click();
      }

      Comments.getSidebar().within(() => {
        cy.findByRole("heading", { name: "Comments about this" }).should(
          "be.visible",
        );

        Comments.getNewThreadInput().click();
        cy.realType("Hello");
        cy.realPress([META_KEY, "Enter"]);
        Comments.getNewThreadInput().within(() => {
          Comments.getPlaceholder().should("be.visible");
        });
      });

      cy.log("highlights related document node");
      getNodeElement()
        .closest("[data-node-view-wrapper]")
        .should("have.attr", "aria-expanded", "true");

      cy.log("shows comments button when comments for the node are open");
      Comments.getDocumentNodeButton({
        targetId,
        childTargetId,
        hasComments: true,
        isCardEmbedNode,
      })
        .should("be.visible")
        .and("contain.text", "1");

      cy.log("can close the sidebar with a keyboard shortcut");
      cy.realPress("Escape");
      Comments.getSidebar().should("not.exist");

      getNodeElement()
        .closest("[data-node-view-wrapper]")
        .should("have.attr", "aria-expanded", "false");

      cy.log("shows comments button when node has unresolved comments");
      Comments.getDocumentNodeButton({
        targetId,
        childTargetId,
        hasComments: true,
        isCardEmbedNode,
      }).should("be.visible");
    }
  });

  it("allows to split a paragraph in two, and then to comment on both paragraphs", () => {
    startNewCommentIn1ParagraphDocument();

    cy.get<DocumentId>("@documentId").then((targetId) => {
      cy.realType("Hello");
      cy.realPress([META_KEY, "Enter"]);
      Comments.getNewThreadInput().within(() => {
        Comments.getPlaceholder().should("be.visible");
      });
      Comments.closeSidebar();

      H.documentContent().click();
      cy.realType("{leftarrow}".repeat("lor sit amet.".length));
      cy.realType("{enter}");
      cy.intercept("PUT", "/api/document/*").as("updateDocument");
      cy.findByRole("button", { name: "Save" }).click();
      // Wait for the save to fully persist. On success the page schedules a
      // navigation back to /document/:id; if that navigation resolves late
      // (e.g. under network throttling) it clobbers the comments route opened
      // below and the sidebar never mounts. Waiting for the request + the
      // "Document saved" toast forces that navigation to settle first.
      cy.wait("@updateDocument");
      H.undoToast().findByText("Document saved").should("be.visible");
      cy.findByRole("button", { name: "Save" }).should("not.exist");

      Comments.getDocumentNodeButton({
        targetId,
        childTargetId: PARAGRAPH_ID,
        hasComments: true,
      }).should("be.visible");

      Comments.getDocumentNodeButtons()
        .filter(":visible")
        .should("have.length", 1);
      H.getParagraph("lor sit amet.").realHover();
      Comments.getDocumentNodeButtons()
        .filter(":visible")
        .should("have.length", 2)
        .last()
        .should("not.contain.text", "1")
        .realClick();

      Comments.getSidebar().within(() => {
        cy.findByRole("heading", { name: "Comments about this" }).should(
          "be.visible",
        );
        Comments.getNewThreadInput().click();
        cy.realType("World");
        cy.realPress([META_KEY, "Enter"]);
        Comments.getCommentByText("World").should("be.visible");
        cy.findByText("Hello").should("not.exist");
      });

      Comments.closeSidebar();
      Comments.getSidebar().should("not.exist");
      Comments.getDocumentNodeButtons()
        .filter(":visible")
        .should("have.length", 2)
        .and(($buttons) => {
          expect($buttons.eq(0)).to.have.text("1");
          expect($buttons.eq(1)).to.have.text("1");
        });
    });
  });

  it("upgrades existing documents without _id attributes in nodes that support comments", () => {
    H.createDocument({
      idAlias: "documentId",
      name: "Lorem ipsum",
      document: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            /* Intentionally commented out: */
            // attrs: {
            //   _id: PARAGRAPH_ID,
            // },
            content: [
              {
                type: "text",
                text: "Lorem ipsum dolor sit amet.",
              },
            ],
          },
        ],
      },
    });
    H.visitDocument("@documentId");
    cy.findByRole("textbox", { name: "Document Title" })
      .should("be.visible")
      .and("have.value", "Lorem ipsum");

    cy.log("document is dirty after schema migration");
    cy.findByRole("button", { name: "Save" }).should("be.visible").click();
    cy.findByRole("button", { name: "Save" }).should("not.exist");

    cy.reload();

    cy.log("document is not dirty after persisting the missing _id");
    cy.findByRole("textbox", { name: "Document Title" })
      .should("be.visible")
      .and("have.value", "Lorem ipsum");
    H.getParagraph().should("be.visible");
    cy.findByRole("button", { name: "Save" }).should("not.exist");
  });

  it("allows editing the document with comments open, and opening comments with unsaved changes", () => {
    create1ParagraphDocument();

    cy.get<DocumentId>("@documentId").then((documentId) => {
      H.visitDocumentComment(documentId, PARAGRAPH_ID);

      // The empty sidebar's new-thread composer autofocuses when it
      // mounts — wait for that to settle so it can't steal focus back
      // after we click into the document below.
      Comments.getNewThreadInput().find(".ProseMirror-focused").should("exist");

      cy.get("main").within(() => {
        H.documentContent().click();
        H.documentContent().find(".ProseMirror-focused").should("exist");

        cy.realType("test");
        cy.findByRole("button", { name: "Save" }).should("exist");

        H.documentContent()
          .find('[contenteditable="true"]')
          .should("be.visible");
        H.documentFormattingMenu().should("not.exist");
      });

      Comments.getNewThreadInput().click();
      Comments.getNewThreadInput().find(".ProseMirror-focused").should("exist");
      cy.realType("Test comment");
      cy.realPress([META_KEY, "Enter"]);
      Comments.getCommentByText("Test comment").should("be.visible");
      cy.findByRole("button", { name: "Save" }).should("be.visible");
      H.getParagraph("Lorem ipsum dolor sit amet.test").should("be.visible");

      cy.findByRole("button", { name: "Save" }).click();
      cy.findByRole("button", { name: "Save" }).should("not.exist");

      cy.log("allows opening comments when document has changes");
      H.visitDocument(documentId);
      Comments.getSidebar().should("not.exist");

      H.documentContent().click();
      cy.realType("xyz");
      cy.findByRole("button", { name: "Save" }).should("be.visible");

      H.getParagraph("Lorem ipsum dolor sit amet.testxyz").realHover();
      Comments.getDocumentNodeButton({
        targetId: documentId,
        childTargetId: PARAGRAPH_ID,
        hasComments: true,
      })
        .should("be.visible")
        .and("contain.text", "1")
        .click();
      Comments.getSidebar().should("be.visible");
      cy.findByRole("button", { name: "Save" }).should("be.visible");

      Comments.openAllComments();
      Comments.getCommentByText("Test comment").should("be.visible");
      cy.findByRole("button", { name: "Save" }).should("be.visible");
    });
  });

  describe("comment editor", () => {
    it("supports formatting via keyboard shortcuts, markdown, and the formatting menu, and emojis", () => {
      startNewCommentIn1ParagraphDocument();

      cy.log("supports basic formatting with keyboard shortcuts");
      cy.realType("bold italic strike code");

      selectCharactersLeft("code".length);
      cy.realPress([META_KEY, "e"]);

      cy.realPress("ArrowLeft");
      cy.realPress("ArrowLeft");
      selectCharactersLeft("strike".length);
      cy.realPress(["Shift", META_KEY, "S"]);

      cy.realPress("ArrowLeft");
      cy.realPress("ArrowLeft");
      selectCharactersLeft("italic".length);
      cy.realPress([META_KEY, "I"]);

      cy.realPress("ArrowLeft");
      cy.realPress("ArrowLeft");
      selectCharactersLeft("bold".length);
      cy.realPress([META_KEY, "B"]);

      cy.findByRole("button", { name: "Send" }).click();

      Comments.getAllComments()
        .should("have.length", 1)
        .eq(0)
        .within(() => {
          cy.get("strong").should("have.text", "bold");
          cy.get("em").should("have.text", "italic");
          cy.get("s").should("have.text", "strike");
          cy.get("code").should("have.text", "code");
        });

      cy.log("supports basic formatting with markdown");
      Comments.getNewThreadInput().click();
      cy.realType("**bold** *italic* ~~strike~~ `code`");
      cy.realPress([META_KEY, "Enter"]);

      Comments.getAllComments()
        .should("have.length", 2)
        .eq(1)
        .within(() => {
          cy.get("strong").should("have.text", "bold");
          cy.get("em").should("have.text", "italic");
          cy.get("s").should("have.text", "strike");
          cy.get("code").should("have.text", "code");
        });

      cy.log("supports basic formatting with formatting menu");
      Comments.getNewThreadInput().click();
      cy.realType("bold italic strike code");

      selectCharactersLeft("code".length);
      H.documentFormattingMenu()
        .should("be.visible")
        .findByRole("button", { name: /format_code/ })
        .click();

      cy.realPress("ArrowLeft");
      cy.realPress("ArrowLeft");
      selectCharactersLeft("strike".length);
      H.documentFormattingMenu()
        .should("be.visible")
        .findByRole("button", { name: /text_strike/ })
        .click();

      cy.realPress("ArrowLeft");
      cy.realPress("ArrowLeft");
      selectCharactersLeft("italic".length);
      H.documentFormattingMenu()
        .should("be.visible")
        .findByRole("button", { name: /text_italic/ })
        .click();

      cy.realPress("ArrowLeft");
      cy.realPress("ArrowLeft");
      selectCharactersLeft("bold".length);
      H.documentFormattingMenu()
        .should("be.visible")
        .findByRole("button", { name: /text_bold/ })
        .click();

      cy.realPress([META_KEY, "Enter"]);

      Comments.getAllComments()
        .should("have.length", 3)
        .eq(2)
        .within(() => {
          cy.get("strong").should("have.text", "bold");
          cy.get("em").should("have.text", "italic");
          cy.get("s").should("have.text", "strike");
          cy.get("code").should("have.text", "code");
        });

      cy.log("supports emojis");
      Comments.getNewThreadInput().click();
      cy.realType(":s");
      Comments.getEmojiPicker()
        .should("be.visible")
        .and("contain.text", "😄")
        .and("contain.text", "💦");

      cy.log("can filter emojis");
      cy.realType("mile");
      Comments.getEmojiPicker()
        .should("be.visible")
        .and("contain.text", "😄")
        .and("not.contain.text", "💦");

      cy.log("can use arrow keys for navigation within the emoji picker");
      cy.realPress("ArrowDown");
      cy.realPress("ArrowRight");
      cy.realPress("Enter");

      Comments.getEmojiPicker().should("not.exist");

      cy.log("can submit first suggestion with Enter");
      cy.realType(":eggplant{enter}");

      cy.log("closes suggestion dialog but not the comments modal on Esc");
      cy.realType(":eg");
      Comments.getEmojiPicker().should("be.visible");
      cy.realPress("Escape");
      Comments.getEmojiPicker().should("not.exist");
      Comments.getSidebar().should("be.visible");

      cy.log("can use mouse to select emoji");
      cy.realType("{backspace}{backspace}{backspace}:egg");
      Comments.getEmojiPicker().findByText("🥚").click();

      Comments.getSidebar().within(() => {
        Comments.getNewThreadInput()
          .should("contain.text", "😊")
          .and("contain.text", "🍆")
          .and("contain.text", "🥚");

        cy.realPress([META_KEY, "Enter"]);
      });

      Comments.getAllComments()
        .should("have.length", 4)
        .eq(3)
        .within(() => {
          cy.contains("😊").should("be.visible");
          cy.contains("🍆").should("be.visible");
          cy.contains("🥚").should("be.visible");
        });
    });

    it("supports mentions, including yourself and users without first and last names", () => {
      cy.request("post", "/api/user", { email: "no-name@metabase.test" });
      cy.intercept({
        method: "GET",
        pathname: "/api/search",
        query: { q: "tAbLes" },
      }).as("searchTables");

      startNewCommentIn1ParagraphDocument();

      cy.realType("@");
      H.documentMentionDialog().within(() => {
        cy.findByText("Lorem ipsum").should("be.visible");
        cy.findByText("First collection").should("be.visible");
        cy.findByText("Browse all").should("be.visible");
        cy.findByText("Bobby Tables").should("not.exist");
      });

      cy.realType("tAbLe");
      H.documentMentionDialog().within(() => {
        cy.findByText("Lorem ipsum").should("not.exist");
        cy.findByText("Bobby Tables").should("be.visible");
        cy.findByText("No Collection Tableton").should("be.visible");
      });

      cy.realType("s");
      cy.wait("@searchTables").its("response.statusCode").should("eq", 200);
      H.documentMentionDialog().within(() => {
        cy.findByText("Bobby Tables").should("be.visible");
        cy.findByText("Bobby Tables's Personal Collection").should(
          "be.visible",
        );
        cy.findByText("No Collection Tableton").should("not.exist");
      });

      cy.realPress("Enter");
      H.documentMentionDialog().should("not.exist");

      cy.log("closes mention dialog but not the comments modal on Esc");
      cy.realType(" @no");
      H.documentMentionDialog().should("be.visible");
      cy.realPress("Escape");
      H.documentMentionDialog().should("not.exist");
      Comments.getSidebar().should("be.visible");

      cy.realType("{backspace}{backspace}{backspace}@none");
      H.documentMentionDialog().findByText("None Tableton").click();

      Comments.getSidebar().within(() => {
        Comments.getNewThreadInput()
          .findByText("@Bobby Tables")
          .should("be.visible");
        Comments.getNewThreadInput()
          .findByText("@None Tableton")
          .should("be.visible");

        cy.realPress([META_KEY, "Enter"]);
      });

      Comments.getAllComments()
        .should("have.length", 1)
        .eq(0)
        .within(() => {
          cy.findByText("a few seconds ago").should("be.visible");
          cy.findByText("@Bobby Tables").should("be.visible");
          cy.findByText("@None Tableton").should("be.visible");
        });

      cy.log("handles mentioning users without first and last names");
      Comments.getNewThreadInput().type("@No");
      Comments.getMentionDialog().findByText("no-name@metabase.test").click();
      Comments.getNewThreadInput().type("needs to see this");
      cy.realPress([META_KEY, "Enter"]);

      Comments.getAllComments().should("have.length", 2);
      // mention is it's own span, so we need to search for the pieces individually
      Comments.getCommentByText("@no-name@metabase.test").should("exist");
      Comments.getCommentByText("needs to see this").should("exist");
    });
  });

  describe("links", () => {
    beforeEach(() => {
      H.grantClipboardPermissions();

      createLoremIpsumDocument();

      cy.get<DocumentId>("@documentId").then((documentId) => {
        createComment(documentId, HEADING_1_ID, "Foo").then(
          ({ body: comment }) => {
            cy.wrap(comment.id).as("headingCommentId");
          },
        );

        createComment(documentId, HEADING_1_ID, "Bar");
        createComment(documentId, PARAGRAPH_ID, "Paragraph Foo");
      });
    });

    it("copies and opens a comment link, switching between open and resolved tabs as its thread is resolved and unresolved, and opens a link to a resolved comment", () => {
      H.visitDocument("@documentId");

      cy.get<number>("@documentId").then((documentId) => {
        Comments.getDocumentNodeButton({
          targetId: documentId,
          childTargetId: HEADING_1_ID,
          hasComments: true,
        }).click();
      });

      Comments.getCommentByText("Foo").realHover();
      Comments.getCommentByText("Foo").findByLabelText("More actions").click();

      H.popover().findByText("Copy link").click();
      H.undoToast().findByText("Copied link").should("be.visible");

      H.readClipboard().then((link) => cy.visit(link));

      cy.get("@documentId").then((documentId) => {
        cy.get("@headingCommentId").then((commentId) => {
          cy.url().then((url) => {
            expect(url).to.match(
              new RegExp(
                `/document/${documentId}/comments/${HEADING_1_ID}#comment-${commentId}$`,
              ),
            );
          });
        });
      });

      Comments.getCommentByText("Foo").should(
        "have.attr",
        "aria-current",
        "location",
      );

      cy.log("opens a comment link in its thread vs. 'All comments'");
      // Visiting the copied link only changes the hash, so reload to open it cold
      cy.reload();
      Comments.getSidebar().within(() => {
        cy.findByRole("heading", { name: "All comments" }).should("not.exist");
        cy.findByRole("heading", { name: "Comments about this" }).should(
          "be.visible",
        );
        cy.findAllByTestId("discussion-comment").should("have.length", 2);
        Comments.getCommentByText("Foo").should(
          "have.attr",
          "aria-current",
          "location",
        );
      });

      cy.log(
        "changes between open/resolved tabs when resolving/unresolving a linked comment",
      );
      Comments.getSidebar()
        .findByTestId("comments-resolved-tab")
        .should("not.exist");
      Comments.resolveCommentByText("Foo");

      Comments.getSidebar()
        .findByTestId("comments-resolved-tab")
        .should("be.visible");

      Comments.reopenCommentByText("Foo");
      Comments.getSidebar()
        .findByTestId("comments-resolved-tab")
        .should("not.exist");

      cy.log("opens a link to a resolved comment correctly");
      cy.get<number>("@headingCommentId").then((commentId) => {
        cy.request("PUT", `/api/comment/${commentId}`, {
          is_resolved: true,
        });
        cy.location("hash").should("eq", `#comment-${commentId}`);
      });
      cy.get<DocumentId>("@documentId").then((documentId) => {
        cy.intercept("GET", `/api/document/${documentId}`).as(
          "resolvedLinkDocument",
        );
      });
      // The page is still on the copied link, so a reload opens it cold
      cy.reload();
      cy.wait("@resolvedLinkDocument");

      Comments.getSidebar().within(() => {
        cy.findByTestId("comments-resolved-tab").should("be.visible");
        cy.findAllByTestId("discussion-comment").should("have.length", 1);
        Comments.getCommentByText("Foo").should(
          "have.attr",
          "aria-current",
          "location",
        );
      });
    });
  });

  describe("top level blocks", () => {
    it("should support top level blocks with markdown and shortcuts and render them after submitting and reloading", () => {
      startNewCommentIn1ParagraphDocument();

      cy.log("blockquote");
      cy.realType("> blockquote");
      H.getBlockquote("blockquote", Comments.getNewThreadInput()).should(
        "be.visible",
      );
      cy.realPress([META_KEY, "Enter"]);
      Comments.getAllComments().should("have.length", 1);
      H.getBlockquote("blockquote", Comments.getAllComments().eq(0)).should(
        "be.visible",
      );

      cy.log("ordered list");
      Comments.getNewThreadInput().click();
      cy.realType("1. ol");
      cy.realPress("Enter");
      cy.realType("two");
      H.getOrderedList("ol", Comments.getNewThreadInput()).should("be.visible");
      H.getOrderedList("two", Comments.getNewThreadInput()).should(
        "be.visible",
      );
      cy.realPress([META_KEY, "Enter"]);
      Comments.getAllComments().should("have.length", 2);
      H.getOrderedList("ol", Comments.getAllComments().eq(1)).should(
        "be.visible",
      );
      H.getOrderedList("two", Comments.getAllComments().eq(1)).should(
        "be.visible",
      );

      cy.log("bullet list");
      Comments.getNewThreadInput().click();
      cy.realType("- ul");
      cy.realPress("Enter");
      cy.realType("b");
      H.getBulletList("ul", Comments.getNewThreadInput()).should("be.visible");
      H.getBulletList("b", Comments.getNewThreadInput()).should("be.visible");
      cy.realPress([META_KEY, "Enter"]);
      Comments.getAllComments().should("have.length", 3);
      H.getBulletList("ul", Comments.getAllComments().eq(2)).should(
        "be.visible",
      );
      H.getBulletList("b", Comments.getAllComments().eq(2)).should(
        "be.visible",
      );

      cy.log("code block");
      Comments.getNewThreadInput().click();
      cy.realType("```");
      cy.realPress("Enter");
      cy.realType("code");
      H.getCodeBlock("code", Comments.getNewThreadInput()).should("be.visible");
      cy.realPress([META_KEY, "Enter"]);
      Comments.getAllComments().should("have.length", 4);
      H.getCodeBlock("code", Comments.getAllComments().eq(3)).should(
        "be.visible",
      );

      cy.log("ordered list shortcut");
      Comments.getNewThreadInput().click();
      cy.realType("ol shortcut");
      cy.realPress([META_KEY, "Shift", "7"]);

      H.getOrderedList("ol shortcut", Comments.getNewThreadInput()).should(
        "be.visible",
      );
      cy.realPress([META_KEY, "Enter"]);
      Comments.getAllComments().should("have.length", 5);
      H.getOrderedList("ol shortcut", Comments.getAllComments().eq(4)).should(
        "be.visible",
      );

      cy.log("bullet list shortcut");
      Comments.getNewThreadInput().click();
      cy.realType("ul shortcut");
      cy.realPress([META_KEY, "Shift", "8"]);

      H.getBulletList("ul shortcut", Comments.getNewThreadInput()).should(
        "be.visible",
      );
      cy.realPress([META_KEY, "Enter"]);
      Comments.getAllComments().should("have.length", 6);
      H.getBulletList("ul shortcut", Comments.getAllComments().eq(5)).should(
        "be.visible",
      );

      cy.log("blockquote shortcut is disabled");
      // CustomBlockquote and CustomBold leave Mod-Shift-b to the browser.
      // Shift+b is sent as key "B", like a real keyboard: a lowercase "b" with
      // shiftKey makes ProseMirror fall back to the Mod-b (bold) binding.
      Comments.getNewThreadInput().click();
      cy.realType("not a quote");
      cy.realPress([META_KEY, "Shift", "B"]);
      cy.realType(" after shortcut");
      Comments.getNewThreadInput()
        .find("p")
        .should("have.text", "not a quote after shortcut");
      Comments.getNewThreadInput().find("blockquote").should("not.exist");
      Comments.getNewThreadInput().find("strong").should("not.exist");
      cy.realPress([META_KEY, "Enter"]);
      Comments.getAllComments().should("have.length", 7);
      Comments.getCommentByText("not a quote after shortcut")
        .find("blockquote")
        .should("not.exist");

      cy.log("code block shortcut");
      Comments.getNewThreadInput().click();
      cy.realType("code shortcut");
      cy.realPress([META_KEY, "Alt", "c"]);

      H.getCodeBlock("code shortcut", Comments.getNewThreadInput()).should(
        "be.visible",
      );
      cy.realPress([META_KEY, "Enter"]);
      Comments.getAllComments().should("have.length", 8);
      H.getCodeBlock("code shortcut", Comments.getAllComments().eq(7)).should(
        "be.visible",
      );

      cy.intercept("GET", "/api/document/*").as("reloadedDocument");
      cy.intercept("GET", "/api/comment?*").as("reloadedComments");
      cy.reload();
      cy.wait(["@reloadedDocument", "@reloadedComments"]);

      // The thread is taller than the sidebar, so scroll each block into view
      H.getBlockquote("blockquote", Comments.getSidebar())
        .scrollIntoView()
        .should("be.visible");
      H.getOrderedList("ol", Comments.getSidebar())
        .scrollIntoView()
        .should("be.visible");
      H.getBulletList("ul", Comments.getSidebar())
        .scrollIntoView()
        .should("be.visible");
      H.getCodeBlock("code", Comments.getSidebar())
        .scrollIntoView()
        .should("be.visible");
      H.getOrderedList("ol shortcut", Comments.getSidebar())
        .scrollIntoView()
        .should("be.visible");
      H.getBulletList("ul shortcut", Comments.getSidebar())
        .scrollIntoView()
        .should("be.visible");
      H.getCodeBlock("code shortcut", Comments.getSidebar())
        .scrollIntoView()
        .should("be.visible");
    });
  });

  describe("email notifications", () => {
    beforeEach(() => {
      H.setupSMTP();
    });

    it("notifies the document owner of a new thread, thread participants of a reply, and an @mentioned user", () => {
      create1ParagraphDocument();

      cy.get<DocumentId>("@documentId").then((documentId) => {
        cy.signInAsNormalUser();
        createParagraphComment(documentId, "Test 1").then(
          ({ body: comment }) => {
            H.getInbox().then((response: any) => {
              const emails = response.body;
              expect(emails).to.have.length(1);

              verifyEmail({
                email: emails[0],
                expected: {
                  address: "admin@metabase.test",
                  subject: "Comment on Lorem ipsum",
                  heading: "Robert Tableton left a comment on a document",
                  documentTitle: "Lorem ipsum",
                  documentHref: `http://localhost:4000/document/${documentId}`,
                  commentHref: `http://localhost:4000/document/${documentId}/comments/${PARAGRAPH_ID}#comment-${comment.id}`,
                },
              });
            });
          },
        );
      });

      cy.log("a new reply in a thread notifies anyone in the thread");
      cy.signInAsAdmin();
      H.clearInbox();
      create1ParagraphDocument();

      cy.get<DocumentId>("@documentId").then((documentId) => {
        createParagraphComment(documentId, "Test 1").then(
          ({ body: threadComment }) => {
            cy.signInAsNormalUser();
            createParagraphComment(documentId, "Test 2", threadComment.id).then(
              ({ body: normalUserReply }) => {
                cy.signInAsImpersonatedUser();
                createParagraphComment(
                  documentId,
                  "Test 3",
                  threadComment.id,
                ).then(({ body: impersonatedUserReply }) => {
                  H.getInbox(3).then((response: any) => {
                    const emails = response.body;
                    cy.log(
                      "you should not get notified about your own comments",
                    );
                    expect(emails).to.have.length(3);

                    const getHeading = (email: any) =>
                      new DOMParser()
                        .parseFromString(email.html, "text/html")
                        .querySelector("h1")?.textContent ?? "";
                    const findEmail = (address: string, heading: string) =>
                      emails.find(
                        (email: any) =>
                          email.to[0].address === address &&
                          getHeading(email).includes(heading),
                      );

                    verifyEmail({
                      email: findEmail(
                        "admin@metabase.test",
                        "Robert Tableton replied to a thread",
                      ),
                      expected: {
                        address: "admin@metabase.test",
                        subject: "Comment on Lorem ipsum",
                        heading: "Robert Tableton replied to a thread",
                        documentTitle: "Lorem ipsum",
                        documentHref: `http://localhost:4000/document/${documentId}`,
                        commentHref: `http://localhost:4000/document/${documentId}/comments/${PARAGRAPH_ID}#comment-${normalUserReply.id}`,
                      },
                    });

                    verifyEmail({
                      email: findEmail(
                        "admin@metabase.test",
                        "User Impersonated replied to a thread",
                      ),
                      expected: {
                        address: "admin@metabase.test",
                        subject: "Comment on Lorem ipsum",
                        heading: "User Impersonated replied to a thread",
                        documentTitle: "Lorem ipsum",
                        documentHref: `http://localhost:4000/document/${documentId}`,
                        commentHref: `http://localhost:4000/document/${documentId}/comments/${PARAGRAPH_ID}#comment-${impersonatedUserReply.id}`,
                      },
                    });

                    verifyEmail({
                      email: findEmail(
                        "normal@metabase.test",
                        "User Impersonated replied to a thread",
                      ),
                      expected: {
                        address: "normal@metabase.test",
                        subject: "Comment on Lorem ipsum",
                        heading: "User Impersonated replied to a thread",
                        documentTitle: "Lorem ipsum",
                        documentHref: `http://localhost:4000/document/${documentId}`,
                        commentHref: `http://localhost:4000/document/${documentId}/comments/${PARAGRAPH_ID}#comment-${impersonatedUserReply.id}`,
                      },
                    });
                  });
                });
              },
            );
          },
        );
      });

      cy.log("an explicit @mention notifies that person");
      cy.signInAsAdmin();
      H.clearInbox();
      create1ParagraphDocument();

      cy.get<DocumentId>("@documentId").then((documentId) => {
        H.createComment({
          target_type: "document",
          target_id: documentId,
          child_target_id: PARAGRAPH_ID,
          parent_comment_id: null,
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                attrs: {
                  _id: PARAGRAPH_ID,
                },
                content: [
                  {
                    type: "smartLink",
                    attrs: {
                      entityId: NORMAL_USER_ID,
                      model: "user",
                      label: "Robert Tableton",
                    },
                  },
                ],
              },
            ],
          },
          html: "<a href='#'>Robert Tableton</a>",
        }).then(({ body: comment }) => {
          H.getInbox().then((response: any) => {
            const emails = response.body;
            expect(emails).to.have.length(1);

            verifyEmail({
              email: emails[0],
              expected: {
                address: "normal@metabase.test",
                subject: "Comment on Lorem ipsum",
                heading: "Bobby Tables left a comment on a document",
                documentTitle: "Lorem ipsum",
                documentHref: `http://localhost:4000/document/${documentId}`,
                commentHref: `http://localhost:4000/document/${documentId}/comments/${PARAGRAPH_ID}#comment-${comment.id}`,
              },
            });
          });
        });
      });
    });
  });
});

function selectCharactersLeft(count: number) {
  for (let i = 0; i < count; ++i) {
    cy.realPress(["Shift", "ArrowLeft"]);
  }
}

function startNewCommentIn1ParagraphDocument() {
  createAndVisit1ParagraphDocument();

  H.getParagraph().realHover();

  cy.get<DocumentId>("@documentId").then((targetId) => {
    Comments.getDocumentNodeButton({
      targetId,
      childTargetId: PARAGRAPH_ID,
    })
      .should("be.visible")
      .click();
  });

  Comments.getSidebar().within(() => {
    cy.findByRole("heading", { name: "Comments about this" }).should(
      "be.visible",
    );
    Comments.getNewThreadInput().click();
  });
}

function createLoremIpsumDocument() {
  return H.createDocument({
    idAlias: "documentId",
    name: "Lorem ipsum",
    document: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: {
            level: 1,
            _id: HEADING_1_ID,
          },
          content: [
            {
              type: "text",
              text: "Heading 1",
            },
          ],
        },
        {
          type: "heading",
          attrs: {
            level: 2,
            _id: HEADING_2_ID,
          },
          content: [
            {
              type: "text",
              text: "Heading 2",
            },
          ],
        },
        {
          type: "heading",
          attrs: {
            level: 3,
            _id: HEADING_3_ID,
          },
          content: [
            {
              type: "text",
              text: "Heading 3",
            },
          ],
        },
        {
          type: "paragraph",
          attrs: {
            _id: PARAGRAPH_ID,
          },
          content: [
            {
              type: "text",
              text: "Lorem ipsum dolor sit amet.",
            },
          ],
        },
        {
          type: "bulletList",
          attrs: {
            _id: BULLET_LIST_ID,
          },
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: {
                    _id: "d89a509c-0a03-3856-8e10-481a58797df1",
                  },
                  content: [
                    {
                      type: "text",
                      text: "Bullet A",
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: {
                    _id: "4080cc00-a884-af5d-8863-643a9490d5ae",
                  },
                  content: [
                    {
                      type: "text",
                      text: "Bullet B",
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: {
                    _id: "f2cb1cfe-5d39-f733-9122-bb5e5f876c17",
                  },
                  content: [
                    {
                      type: "text",
                      text: "Bullet C",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "blockquote",
          attrs: {
            _id: BLOCKQUOTE_ID,
          },
          content: [
            {
              type: "paragraph",
              attrs: {
                _id: "0c48f302-cb8d-ca5b-9c6f-32a7b3723c53",
              },
              content: [
                {
                  type: "text",
                  text: "A famous quote",
                },
              ],
            },
          ],
        },
        {
          type: "orderedList",
          attrs: {
            start: 1,
            type: null,
            _id: ORDERED_LIST_ID,
          },
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: {
                    _id: "1b044a62-221e-0ee9-f68f-3a8e026c073d",
                  },
                  content: [
                    {
                      type: "text",
                      text: "Item 1",
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: {
                    _id: "53cb6ee7-6012-2fd6-61e1-5a4a22ba38d0",
                  },
                  content: [
                    {
                      type: "text",
                      text: "Item 2",
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  attrs: {
                    _id: "a3ba73b9-4f43-e1f6-4867-832fa0dc2df1",
                  },
                  content: [
                    {
                      type: "text",
                      text: "Item 3",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "codeBlock",
          attrs: {
            language: null,
            _id: CODE_BLOCK_ID,
          },
          content: [
            {
              type: "text",
              text: "while (true) {}",
            },
          ],
        },
        {
          type: "resizeNode",
          attrs: {
            height: 350,
            minHeight: 280,
          },
          content: [
            {
              type: "cardEmbed",
              attrs: {
                id: ORDERS_QUESTION_ID,
                name: null,
                _id: CARD_EMBED_ID,
              },
            },
          ],
        },
        {
          type: "paragraph",
          attrs: {
            _id: "b0ab4c7e-7802-c6f7-2708-0f63bdd0b129",
          },
        },
      ],
    },
  });
}

function createAndVisitLoremIpsumDocument() {
  createLoremIpsumDocument();
  H.visitDocument("@documentId");
  cy.findByRole("textbox", { name: "Document Title" })
    .should("be.visible")
    .and("have.value", "Lorem ipsum");
}

function create1ParagraphDocument() {
  H.createDocument({
    idAlias: "documentId",
    name: "Lorem ipsum",
    document: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: {
            _id: PARAGRAPH_ID,
          },
          content: [
            {
              type: "text",
              text: "Lorem ipsum dolor sit amet.",
            },
          ],
        },
      ],
    },
  });
}

function createAndVisit1ParagraphDocument() {
  create1ParagraphDocument();
  H.visitDocument("@documentId");
  cy.findByRole("textbox", { name: "Document Title" })
    .should("be.visible")
    .and("have.value", "Lorem ipsum");
}

function createParagraphComment(
  documentId: DocumentId,
  text: string,
  parent_comment_id: CommentId | null = null,
) {
  return createComment(documentId, PARAGRAPH_ID, text, parent_comment_id);
}

function createComment(
  documentId: DocumentId,
  nodeId: string,
  text: string,
  parent_comment_id: CommentId | null = null,
  html?: string,
) {
  return H.createComment({
    target_type: "document",
    target_id: documentId,
    child_target_id: nodeId,
    parent_comment_id,
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { _id: uuid() },
          content: [{ type: "text", text }],
        },
      ],
    },
    html: html ?? `<p>${text}</p>`,
  });
}

function verifyEmail({
  email,
  expected,
}: {
  email: {
    subject: string;
    to: { address: string }[];
    html: string;
  };
  expected: {
    subject: string;
    address: string;
    heading: string;
    documentHref: string;
    documentTitle: string;
    commentHref: string;
  };
}) {
  const { subject, to, html } = email;
  expect(subject).to.eq(expected.subject);
  expect(to).to.have.length(1);
  expect(to[0].address).to.eq(expected.address);

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");

  cy.log("heading");
  expect(document.querySelector("h1")).to.contain.text(expected.heading);

  cy.log("link to the document");
  expect(
    document.querySelector(`a[href="${expected.documentHref}"]`),
  ).to.contain.text(expected.documentTitle);

  cy.log("link to the comment");
  expect(
    document.querySelector(`a[href="${expected.commentHref}"]`),
  ).to.contain.text("Open in Metabase");

  cy.log("link to the instance");
  expect(
    document.querySelector('a[href="http://localhost:4000"]'),
  ).to.contain.text("http://localhost:4000");

  cy.log("Metabase company name");
  const hasCompanyName = [...document.querySelectorAll("*")].some((element) => {
    return element.textContent?.trim() === "Metabase, Inc.";
  });
  expect(hasCompanyName).to.be.true;

  cy.log("Metabase company address");
  const hasCompanyAddress = [...document.querySelectorAll("*")].some(
    (element) =>
      element.textContent?.trim() ===
      "9740 Campo Rd., Suite 1029, Spring Valley, CA 91977",
  );
  expect(hasCompanyAddress).to.be.true;

  cy.log("Metabase website");
  expect(
    document.querySelector('a[href="https://www.metabase.com"]'),
  ).to.contain.text("www.metabase.com");
}

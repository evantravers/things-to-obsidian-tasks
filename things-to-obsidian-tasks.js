// ToDo Object : Represents a Things to do.
// elements
// contains tags; contained by application, areas, lists, contacts, projects, tags.
// properties
// id (text, r/o) : The unique identifier of the to do.
// name (text) : Name of the to do
// creationDate (date) : Creation date of the to do
// modificationDate (date) : Modification date of the to do
// dueDate (date) : Due date of the to do
// activationDate (date, r/o) : Activation date of the scheduled to do
// completionDate (date) : Completion date of the to do
// cancellationDate (date) : Cancellation date of the to do
// status ("open"/‌"completed"/‌"canceled") : Status of the to do
// tagNames (text) : Tag names separated by comma
// notes (text) : Notes of the to do
// project (Project) : Project the to do belongs to
// area (Area) : Area the to do belongs to
// contact (Contact) : Contact the to do is assigned to
// methods
// move, schedule, show, edit.

(function() {
  var Things = Application("Things");
  var se = Application('System Events')
  app = Application.currentApplication()
  app.includeStandardAdditions = true;

  // Things doesn't give access to a Checklist for a To-do, so I'm scraping the
  // screen for it. :P
  const processClipboard = function(task, toDo) {
    app.setTheClipboardTo("[NONE]")

    Things.activate()
    Things.show(toDo)

    delay(.1)
    se.keystroke('c', { using: [ 'command down' ] }) // boy this is nasty
    delay(.1)

    let clipboard = app.theClipboard()

    let checklist =
    clipboard
    .slice() // to make a copy of it
    .replaceAll(/\r/g, "\n")
    .split(/\n/)
    .filter(function(line) {
      if (line.match(/^- \[ \]/m)) {
        return true;
      }
      return false;
    })
    .join("\n")

    if (checklist != "") { task.checklist = checklist.replace(/^/gm, "  ") }

    if (clipboard.match("When: Someday")) { addTag(task, "#Someday") }
  }

  // FIXME: Does this function actually use `tags` anywhere?
  const computeTag = function(tags, tag) {
    let label =
      tag.name()
      .replace("<1h", "30m")
      .replace(/@/g, "")
      .replace(/:/g, "")
      .replace(/$/g, "")
      .replace(/ /g, "")
      .replace(/[^a-zA-Z0-9_@.]/g, "")

    if (tag.parentTag()) { return `${computeTag(tags, tag.parentTag())}/#${label}`; }

    return `#${label}`;
  }

  const addTag = function(task, tag) {
    if (Array.isArray(task.tags)) {
      task.tags.push(tag)
    }
    else {
      task.tags = [tag];
    }
  }

  const addTags = function(task, toDo) {
    let tags = task.tags;

    if (toDo.tags().length > 0) {
      toDo.tags().forEach(tag => tags.push(computeTag(tags, tag)))
    }
  }

  const addProject = function(task, toDo) {
    let project = "";
    let dot     = "";
    let area    = "";

    if (toDo.project()) {
      project = `${toDo.project().name()}`
    }
    if (toDo.project() && toDo.project().area()) {
      area = `${toDo.project().area().name()}`
    }
    if (project != "" && area != "") {
      dot = "."
    }

    task.project = `${area}${dot}${project}`
  }

  const ISOdate = function(date) {
    date.toISOString().split("T")[0];
  }

  const addNotes = function(task, toDo) {
    if (toDo.notes()) { task.notes = toDo.notes() }
  }

  const addDue = function(task, toDo) {
    if (toDo.dueDate()) { task.due = ISOdate(toDo.dueDate()) }
  }

  const addScheduled = function(task, toDo) {
    if (toDo.activationDate()) { task.scheduled = ISOdate(toDo.activationDate()) }
  }

  const renderTags = function(task) {
    if (task.tags.length > 0) {
      return ` ${task.tags.join(" ")}`
    } else { return "" }
  }

  const renderDate = function(label, date) {
    if (date) {
      return ` [${label}:: ${date}]`
    }
    else {
      return ""
    }
  }

  const renderNotes = function(task) {
    if (task.notes) {
      return `\n${task.notes}`
    } else { return "" }
  }
  const renderList = function(task) {
    if (task.checklist) { return `\n${task.checklist}` }
    else { return "" }
  }

  const writeTextToFile = function(text, file) {
    try {

      // Convert the file to a string
      // var fileString = file.toString()
      var str = $.NSString.alloc.initWithUTF8String(text);
      str.writeToFileAtomicallyEncodingError(file, true, $.NSUTF8StringEncoding, null)

      // Return a boolean indicating that writing was successful
      return true
    }
    catch(error) {
      // Return a boolean indicating that writing was successful
      return false
    }
  }

  const renderTask = function(task) {
    return `- [ ] ${task.name}${renderTags(task)}${renderDate("scheduled", task.scheduled)}${renderDate("due", task.due)}${renderNotes(task)}${renderList(task)}`
  }

  Things.launch();

  const task = function(toDo) {
    let task = {
      name: toDo.name(),
      tags: [],
    }

    addNotes(task, toDo)
    addTags(task, toDo)
    addProject(task, toDo)

    processClipboard(task, toDo)

    addDue(task, toDo)
    addScheduled(task, toDo)

    return renderTask(task)
  }

  app.doShellScript(`mkdir -p projects`);
  // I don't have to include the Anytime and Someday list in the same way
  // because I don't have any ToDos outside of Projects or Areas.
  Things.projects().filter(p => p.status() == "open").forEach(function(proj) {
    console.log(`Processing... ${proj.name()}`)

    let attributes = [];

    // FIXME: Why can't I just use ISOdate() here?
    if (proj.dueDate() != null) {
      attributes.push(`due: ${proj.dueDate().toISOString().split("T")[0]}`);
    }

    // Nothing has tags atm.
    //if (tags > 0) {
    //  attributes.push(`tags:\n${tags.join("\n").map(s => `- ${s}`)}`)
    //}
    attributes.push(`tags:\n- projects`)

    attributes = attributes.join("\n")

    if (attributes != "") {
      attributes = `---\n${attributes}\n---\n`
    }

    let tasks = proj.toDos().map(function(t) {
      return task(t)
    })
    .join("\n")

    let template = `${attributes}${proj.notes()}\n${tasks}`

    writeTextToFile(template, `projects/${proj.name()}.md`)
  })
})();

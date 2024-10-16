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

    if (checklist != "") { addAnnotation(task, "Checklist:\n" + checklist) }

    if (clipboard.match("When: Someday")) { scheduledSomeday(task) }
  }

  const computeTag = function(tags, tag) {
    if (tag.parentTag()) { return `${computeTag(tags, tag.parentTag())}.${tag.name()}`; }

    return tag.name();
  }

  const addTags = function(task, toDo) {
    let tags = [];

    if (toDo.tags().length > 0) {
      toDo.tags().forEach(tag => tags.push(computeTag(tags, tag)))
    }

    if (tags.length > 0) { task.tags = ` ${tags}` };
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
    if (toDo.notes()) { task.notes = `\n${toDo.notes()}`}
  }

  const addDue = function(task, toDo) {
    if (toDo.dueDate()) { task.due = ` ${ISOdate(toDo.dueDate())}` }
  }

  const addScheduled = function(task, toDo) {
    if (toDo.activationDate()) { task.scheduled = ` ${ISOdate(toDo.activationDate())}` }
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
    return `- [ ] ${task.name}${task.tags}${task.scheduled}${task.due}${task.notes}${task.checklist}`
  }

  Things.launch();

  let tasks    = [];
  let areas    = [];
  let projects = [];

  Things.toDos().forEach(function(toDo) {
    let task = {
      name: toDo.name(),
      notes : "",
      due: "",
      tags: "",
      scheduled: "",
      checklist: ""
    }

    addNotes(task, toDo)
    addTags(task, toDo)
    addProject(task, toDo)

    //processClipboard(task, toDo)

    addDue(task, toDo)
    addScheduled(task, toDo)

    console.log(renderTask(task))

    tasks.push(task)
  })

  app.doShellScript(`mkdir -p projects`);
  Things.projects().filter(p => p.status() == "open").forEach(function(proj) {
    let obj = {};
    addDue(obj, proj);
    addTags(obj, proj);

    let attr = "";

    for (let k in obj) {
      attr = attr + `\n${k}: ${obj[k]}`
    }

    let template = `---${attr}
---

# ${proj.name()}

${proj.notes()}

`
    writeTextToFile(template, `projects/${proj.name()}.md`)
  })
})();

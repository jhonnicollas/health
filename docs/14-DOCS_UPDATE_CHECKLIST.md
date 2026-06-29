# DOCS_UPDATE_CHECKLIST.md — Documentation Update Rules

Every completed task must update documentation or explicitly log that docs were reviewed and no update was needed.

## 1. Universal Docs Required After Every Task

```text
[ ] TASKS.md updated
[ ] WORK_LOG.md appended
[ ] HANDOFF.md updated
```

## 2. API Task Documentation

Update `api-contract.md` if the task changes:

```text
[ ] endpoint path
[ ] method
[ ] request body
[ ] response body
[ ] error code
[ ] auth/permission rule
[ ] rate limit behavior
[ ] timeout behavior
```

## 3. Architecture Task Documentation

Update `ARCHITECTURE.md` if the task changes:

```text
[ ] system component
[ ] data flow
[ ] queue flow
[ ] AI flow
[ ] notification flow
[ ] R2 storage flow
[ ] security boundary
```

## 4. Database Task Documentation

Update `schema.sql` if the task changes:

```text
[ ] table
[ ] field
[ ] index
[ ] constraint
[ ] migration requirement
```

Rules:

```text
[ ] all table names start with HL_
[ ] no underscore after HL_
[ ] all fields camelCase
[ ] no new database created
```

## 5. Seed Task Documentation

Update `seed.sql` or seed generator if the task changes:

```text
[ ] devices
[ ] metric catalog
[ ] metric rules
[ ] badges
[ ] knowledge base
```

## 6. UI Task Documentation

Update `design-system.md` if the task changes:

```text
[ ] component
[ ] layout
[ ] theme
[ ] senior mode
[ ] high contrast mode
[ ] form state
[ ] validation style
[ ] popup/modal behavior
```

## 7. Medical Rule Task Documentation

Update both `seed.sql` and rule docs if the task changes:

```text
[ ] metricCode
[ ] unit
[ ] minValue
[ ] maxValue
[ ] status
[ ] severity
[ ] popupTitle
[ ] popupMessage
[ ] recommendation
[ ] sourceLabel
[ ] emergencyLevel
```

Also validate:

```text
[ ] AI does not decide severity
[ ] AI does not diagnose
[ ] AI does not prescribe medicine
```

## 8. Attachment/Image Task Documentation

Update architecture and API docs if the task changes:

```text
[ ] no original image stored
[ ] client compression documented
[ ] watermark fields documented
[ ] R2 path documented
[ ] file type/size rules documented
```

## 9. Notification Task Documentation

Update architecture and API docs if the task changes:

```text
[ ] Telegram flow
[ ] browser notification flow
[ ] queue behavior
[ ] failure handling
[ ] HL_notifications status
[ ] submit non-blocking behavior
```

## 10. Completion Statement

At the end of every `WORK_LOG.md` completed entry, write one of these:

```text
Documentation updated.
```

or

```text
Documentation reviewed; no changes required.
```

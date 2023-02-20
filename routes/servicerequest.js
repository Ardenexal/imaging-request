const express = require('express');
const router = express.Router();
const patient_svc = require('../services/patient_svc');
const practitioner_svc = require('../services/practitioner_svc');
const practitionerrole_svc = require('../services/practitionerrole_svc');
const organization_svc = require('../services/organization_svc');
const servicerequest_svc = require('../services/servicerequest_svc');

function buildServiceRequest(data) {
  const servicerequest = {
    "resourceType": "ServiceRequest",
    "meta": {
      "profile": [ "http://hl7.org.au/fhir/StructureDefinition/au-diagnosticrequest" ]
    },

    // TODO: requisition
    //   placer_organization_name => assigner
    //   placer_organization_hpio => system
    //   placer_group_identifier => value
    "requisition": {        
      "assigner": { "display": data.placer_organization_name },  
      "system": `http://ns.electronichealth.net.au/id/hpio-scoped/order/1.0/${data.placer_organization_hpio}`,  
      "type": {
        "coding": [{
          "code": "PGN", 
          "display": "Placer Group Identifier",
          "system": "http://terminology.hl7.org/CodeSystem/v2-0203"
        }]
      },
      "value": data.placer_group_identifier
    },
    // TODO: status
    "status": data.status,
    // TODO: intent
    "intent": "order",
    // TODO: category
    "category": [
      {
        "coding": [
          {
            "code": data.category_code,
            "display": data.category_display,
            "system": "http://snomed.info/sct"
          }
        ]
      }
    ],
    // TODO: priority
    "priority": data.priority,
    // TODO: code
    "code": {
      "coding": [
        {
        "code": data.request_code_code,                    
        "display": data.request_code_display,
        "system": "http://snomed.info/sct"
        }
      ]
    },
    // TODO subject
    "subject": {
      "reference": `Patient/${data.patient_id}`
    },
    // TODO authoredOn
    "authoredOn": data.authoredOn,
    // TODO requester 
    //   placer_practitionerrole_id
    "requester": {
      "reference": `PractitionerRole/${data.placer_practitionerrole_id}`
    },
    // performerType
    "performerType": {
      "coding": [
        {
        "code": data.performerType_code,
        "display": data.performerType_display,
        "system": "http://snomed.info/sct"
        }
      ]
    }    
  }
  
  // reasonCode
  if (data.reasonCode_code) {
    servicerequest.reasonCode = [
      {
        "coding": [
          {
            "code": data.reasonCode_code,
            "display": data.reasonCode_display,
            "system": "http://snomed.info/sct"
          }
        ]
      }
    ]
  }

  return servicerequest;
}

router.get('/', async function(req, res, next) {
  const session = req.session;

  if (session.patient_id) {
    let patient = await patient_svc.readPatient(req.app, session.patient_id);
    let practitioner = await practitioner_svc.read(req.app, session.practitioner_id);
    let practitioner_role = await practitionerrole_svc.read(req.app, session.practitioner_role_id);
    let placer_organization = await organization_svc.read(req.app, session.placer_organization_id);
    let filler_organization = await organization_svc.read(req.app, session.filler_organization_id);

    res.render('servicerequest-create', { title: 'New Service Request', patient, practitioner, practitioner_role, placer_organization, filler_organization });
  }
  else {
    res.redirect("/");  // initialise app
  }
});

router.post('/', async function(req, res, next) {
  const data = req.body;

  try {
    // requisition placer group identifier
    data.placer_group_identifier = `ORD${data.placer_organization_hpio.substring(11)}-${String(Math.floor(Math.random() * 1000000)).padStart(5, "0")}`;

    // request code coding
    if ( data.request_code !== '')
    {
      const service_parts =  data.request_code.split(' ');
      data.request_code_code = service_parts[0];
      // trim double quotes from start and end
      data.request_code_display = service_parts[1].replace(/^"(.+(?="$))"$/, '$1');
    }
    else {
      throw ("Service requested is required");
    }
    
    // status
    data.status = "active";
    
    // catgeory
    data.category_code = "363679005";
    data.category_display = "Imaging";

    // performerType
    data.performerType_code = "78729002";
    data.performerType_display = "Diagnostic radiologist";

    // authoredOn
    data.authoredOn = new Date().toISOString();

    console.log(data);

    const servicerequest = buildServiceRequest(data);
    const result = await servicerequest_svc.create(req.app, servicerequest);

    res.redirect(`/servicerequest/${result.id}`);
  }
  catch (error) {
    next(error);
  } 

});

router.get('/:id', async function(req, res, next) {

  const id = req.params['id'];
  try {
    const servicerequest = await servicerequest_svc.read(req.app, id, true);
    res.render('servicerequest-view', { title: 'Service Request', servicerequest });
  }
  catch (error) {
    next(error);
  } 
});


module.exports = router;

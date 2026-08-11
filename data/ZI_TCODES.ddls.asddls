
@AccessControl.authorizationCheck: #NOT_REQUIRED

@EndUserText.label: 'Transaktionscodes'

@Metadata.ignorePropagatedAnnotations: true

define view entity ZI_TCODES
  as select from tstc

  association [0..1] to tstct as _TextLangu
    on  $projection.Tcode = _TextLangu.tcode
    and _TextLangu.sprsl  = $session.system_language

  association [0..1] to tstct as _TextEN
    on  $projection.Tcode = _TextEN.tcode
    and _TextEN.sprsl     = 'E'

{
  key tcode                                     as Tcode,

      coalesce(_TextLangu.ttext, _TextEN.ttext) as Text
}
where tcode not like 'Z%'

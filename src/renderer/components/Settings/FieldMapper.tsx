import React from 'react';
import { DataSource, FieldMapping } from '../../../shared/types';
import Select from '../common/Select';

interface FieldMapperProps {
  fields: string[];
  mapping: FieldMapping;
  onChange: (mapping: FieldMapping) => void;
}

const FieldMapper: React.FC<FieldMapperProps> = ({ fields, mapping, onChange }) => {
  const dataSourceOptions = [
    { value: DataSource.None, label: '(None)' },
    { value: DataSource.Word, label: 'Word' },
    { value: DataSource.WordType, label: 'Word Type' },
    { value: DataSource.Definition, label: 'Definition' },
    { value: DataSource.DefinitionExample, label: 'Definition Example' },
    { value: DataSource.Transcription, label: 'Transcription' },
    { value: DataSource.Examples, label: 'Example(s)' },
    { value: DataSource.WordAudio, label: 'Word Audio' },
    { value: DataSource.ExampleType, label: 'Example Type' }
  ];

  const handleFieldMappingChange = (fieldName: string, source: DataSource) => {
    const newMapping = { ...mapping, [fieldName]: source };
    onChange(newMapping);
  };

  return (
    <div className="field-mapper">
      {fields.map((fieldName) => (
        <div key={fieldName} className="field-mapping-row">
          <span className="field-name">{fieldName}</span>
          <Select
            value={mapping[fieldName] || DataSource.None}
            onChange={(e) => handleFieldMappingChange(fieldName, e.target.value as DataSource)}
            options={dataSourceOptions}
          />
        </div>
      ))}
    </div>
  );
};

export default FieldMapper;
